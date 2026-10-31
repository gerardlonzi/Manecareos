"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileUp, RotateCcw, FileSpreadsheet, CheckCircle2, Info } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { finalizeImport, getExistingIdentifiers, importStaffBatch, type ImportRowFailure } from "@/actions/import";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/form";
import { AvailabilityBadge } from "@/components/ui/badge";
import { APP_CONFIG } from "@/config/app";
import { chunk } from "@/lib/concurrency";
import { errorReportCsv, importTemplateCsv, parseStaffCsv, type ImportParseResult, type RowIssue } from "@/lib/csv/import";
import { downloadCsv } from "@/lib/download";

type Stage = "choose" | "preview" | "importing" | "done";
type Summary = { total: number; inserted: number; updated: number; rejected: number; located: number; locationPending: number };

/** Lit un classeur Excel (première feuille) et le convertit en CSV pour réutiliser la même validation. */
async function xlsxToCsv(file: File): Promise<string> {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  const data = sheets[0]?.data ?? [];
  const rows = data.map((r) => r.map((c) => (c === null || c === undefined ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))));
  return Papa.unparse(rows);
}

export function ImportWizard({ defaultCountry }: { defaultCountry: string }) {
  const router = useRouter();
  const { t, tm } = usePreferences();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [stage, setStage] = React.useState<Stage>("choose");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [parsed, setParsed] = React.useState<ImportParseResult | null>(null);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [serverFailures, setServerFailures] = React.useState<ImportRowFailure[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const cancelled = React.useRef(false);

  const reset = () => {
    setStage("choose"); setFile(null); setParsed(null); setFileError(null); setServerFailures([]); setSummary(null); setProgress({ done: 0, total: 0 });
    cancelled.current = false;
    if (inputRef.current) inputRef.current.value = "";
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const f = e.target.files?.[0] ?? null;
    if (f && !/\.(csv|xlsx)$/i.test(f.name)) { setFileError(t("Choisissez un fichier .xlsx (Excel) ou .csv.", "Choose an .xlsx (Excel) or .csv file.")); setFile(null); return; }
    if (f && f.size > APP_CONFIG.import.maxFileBytes) { setFileError(t(`Fichier trop volumineux (${(APP_CONFIG.import.maxFileBytes / 1024 / 1024).toFixed(0)} Mo maximum).`, `File too large (${(APP_CONFIG.import.maxFileBytes / 1024 / 1024).toFixed(0)} MB maximum).`)); setFile(null); return; }
    setFile(f);
  };

  const preview = async () => {
    if (!file) { setFileError(t("Choisissez d’abord un fichier.", "Choose a file first.")); return; }
    setParsing(true);
    setFileError(null);
    try {
      const text = /\.xlsx$/i.test(file.name) ? await xlsxToCsv(file) : await file.text();
      const ex = await getExistingIdentifiers();
      if (!ex.ok) { setFileError(tm(ex.error)); return; }
      const result = parseStaffCsv(text, { defaultCountry, existingCodes: ex.data?.codes, existingEmails: ex.data?.emails });
      if (result.missingRequired.length > 0) { setFileError(t(`Colonne obligatoire manquante : ${result.missingRequired.join(", ")}. Téléchargez le modèle.`, `Required column missing: ${result.missingRequired.join(", ")}. Download the template.`)); return; }
      setParsed(result);
      setStage("preview");
    } catch {
      setFileError(t("Lecture du fichier impossible. Vérifiez qu’il n’est pas protégé par mot de passe.", "Could not read the file. Check it is not password-protected."));
    } finally {
      setParsing(false);
    }
  };

  const confirm = async () => {
    if (!parsed) return;
    cancelled.current = false;
    setStage("importing");
    const batches = chunk(parsed.rows, APP_CONFIG.import.batchSize);
    setProgress({ done: 0, total: parsed.rows.length });
    let inserted = 0, updated = 0, located = 0, pending = 0;
    const failures: ImportRowFailure[] = [];
    let done = 0;
    for (const b of batches) {
      if (cancelled.current) break;
      const r = await importStaffBatch(b);
      if (!r.ok || !r.data) {
        for (const row of b) failures.push({ rowNumber: row.rowNumber, field: "lot", message: r.ok ? "Réponse vide" : r.error });
      } else {
        inserted += r.data.inserted; updated += r.data.updated; located += r.data.located; pending += r.data.locationPending;
        failures.push(...r.data.failures);
      }
      done += b.length;
      setProgress({ done, total: parsed.rows.length });
    }
    const rejected = new Set(parsed.issues.map((i) => i.rowNumber)).size + failures.length;
    const s: Summary = { total: parsed.totalRows, inserted, updated, rejected, located, locationPending: pending };
    setServerFailures(failures);
    setSummary(s);
    await finalizeImport({ fileName: file?.name, totalRows: s.total, inserted, updated, rejected, located, locationPending: pending });
    setStage("done");
    router.refresh();
    toast.success(t(`${inserted} créé(s), ${updated} mis à jour`, `${inserted} created, ${updated} updated`));
  };

  const allIssues: RowIssue[] = [...(parsed?.issues ?? []), ...serverFailures.map((f) => ({ rowNumber: f.rowNumber, field: f.field, message: f.message }))];
  const downloadErrors = () => downloadCsv("rapport-erreurs-import.csv", errorReportCsv(allIssues));
  const issueRows = new Set((parsed?.issues ?? []).map((i) => i.rowNumber)).size;
  const created = parsed?.rows.filter((r) => r.action === "create").length ?? 0;
  const willUpdate = parsed?.rows.filter((r) => r.action === "update").length ?? 0;

  const templateButtons = (
    <div className="flex flex-wrap gap-2">
      <a href="/templates/modele-import-staff.xlsx" download className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-primary-soft"><Download className="h-4 w-4" aria-hidden />{t("Modèle Excel (.xlsx)", "Excel template (.xlsx)")}</a>
      <Button variant="secondary" onClick={() => downloadCsv("modele-import-staff.csv", importTemplateCsv())}><Download className="h-4 w-4" aria-hidden />{t("Modèle CSV", "CSV template")}</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {stage === "choose" ? <>
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-soft/70 via-surface to-surface p-5 sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-surface px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden /> {t("Import Excel / CSV", "Excel / CSV import")}</div>
              <h2 className="text-2xl font-semibold tracking-tight">{t("Importez et mettez à jour votre équipe.", "Import and update your team.")}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{t("Déposez votre fichier Excel : les personnes déjà enregistrées (même Code ou même e-mail) sont mises à jour, les autres sont créées. Rien n’est enregistré avant votre confirmation.", "Drop your Excel file: people already registered (same Code or same email) are updated, the others are created. Nothing is saved until you confirm.")}</p>
            </div>
            {templateButtons}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary"><Download className="h-4 w-4" aria-hidden /></span><p className="mt-3 text-sm font-semibold">{t("1. Télécharger", "1. Download")}</p><p className="mt-1 text-xs leading-5 text-muted">{t("Le modèle contient les bonnes colonnes, déjà reconnues.", "The template has the right, already recognised columns.")}</p></div>
            <div className="rounded-xl border border-line bg-surface p-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary"><FileSpreadsheet className="h-4 w-4" aria-hidden /></span><p className="mt-3 text-sm font-semibold">{t("2. Compléter", "2. Fill in")}</p><p className="mt-1 text-xs leading-5 text-muted">{t("Une ligne par personne. Compétences : SW (Support Worker), HCA (Healthcare Assistant), RGN… séparées par « / ».", "One row per person. Skills: SW (Support Worker), HCA (Healthcare Assistant), RGN… separated by “/”.")}</p></div>
            <div className="rounded-xl border border-line bg-surface p-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-success-soft text-success"><CheckCircle2 className="h-4 w-4" aria-hidden /></span><p className="mt-3 text-sm font-semibold">{t("3. Vérifier et importer", "3. Check and import")}</p><p className="mt-1 text-xs leading-5 text-muted">{t("L’aperçu indique les créations, les mises à jour et les lignes à corriger.", "The preview shows creations, updates and rows to fix.")}</p></div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface/80 p-3 text-xs leading-5 text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /><p><strong>{t("Colonnes :", "Columns:")}</strong> Code, full_name ({t("obligatoire", "required")}), Phone, email, country, POSTCODE, city, region, skills, availability, notes, weekly hours. <strong>{t("Heures :", "Hours:")}</strong> 20, 20hours, Full Time (= 37,5 h). <strong>{t("Formats :", "Formats:")}</strong> .xlsx, .csv — {t("5 Mo, 5 000 lignes maximum.", "5 MB, 5,000 rows maximum.")}</p></div>
        </div>
      </> : null}

      {stage === "choose" ? (
        <Card>
          <CardHeader title={t("1. Choisir un fichier", "1. Choose a file")} description={t("Excel (.xlsx) ou CSV. Aucune ligne n’est enregistrée avant votre confirmation.", "Excel (.xlsx) or CSV. No row is saved before you confirm.")} />
          <CardBody className="space-y-4">
            <Field id="import-file" label={t("Fichier Excel ou CSV", "Excel or CSV file")} error={fileError ?? undefined}>
              <input ref={inputRef} id="import-file" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onPick} className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-bg" />
            </Field>
            <p className="text-xs text-muted">{t("Une disponibilité vide reste « Inconnue » pour une nouvelle fiche et ne change pas celle d’une fiche existante. Une cellule vide n’efface jamais une donnée déjà enregistrée.", "An empty availability stays “Unknown” for a new record and does not change an existing one. An empty cell never erases stored data.")}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <LinkButton href="/staff" variant="ghost">{t("Annuler", "Cancel")}</LinkButton>
              <Button pending={parsing} disabled={!file} onClick={preview}><FileUp className="h-4 w-4" aria-hidden /> {t("Téléverser et prévisualiser", "Upload and preview")}</Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {stage === "preview" && parsed ? (
        <Card>
          <CardHeader title={t("2. Aperçu et validation", "2. Preview and validation")} description={file?.name} />
          <CardBody className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {([[t("Lignes lues", "Rows read"), parsed.totalRows], [t("À créer", "To create"), created], [t("À mettre à jour", "To update"), willUpdate], [t("Lignes rejetées", "Rejected rows"), issueRows], [t("Avertissements", "Warnings"), parsed.warnings.length]] as [string, number][]).map(([l, v]) => (
                <div key={l} className="rounded-lg border border-line p-3"><dt className="text-xs text-muted">{l}</dt><dd className="text-xl font-semibold">{v}</dd></div>
              ))}
            </dl>
            {parsed.skippedEmpty > 0 ? <p className="text-xs text-muted">{t(`${parsed.skippedEmpty} ligne(s) vide(s) ou résiduelle(s) ignorée(s).`, `${parsed.skippedEmpty} empty or leftover row(s) ignored.`)}</p> : null}
            {parsed.truncated ? <Alert tone="warning">{t(`Le fichier dépasse ${APP_CONFIG.import.maxRows} lignes : seules les ${APP_CONFIG.import.maxRows} premières sont traitées.`, `The file exceeds ${APP_CONFIG.import.maxRows} rows: only the first ${APP_CONFIG.import.maxRows} are processed.`)}</Alert> : null}
            <div>
              <h3 className="mb-1 text-sm font-semibold">{t("Correspondance des colonnes", "Column mapping")}</h3>
              <ul className="flex flex-wrap gap-2 text-xs">
                {parsed.headers.map((h) => <li key={h.original} className={`rounded-full px-2 py-1 ring-1 ring-inset ${h.mapped ? "bg-success-soft text-success ring-green-200" : "bg-surface-2 text-muted ring-line"}`}>{h.original} → {h.mapped ?? t("ignorée", "ignored")}</li>)}
              </ul>
            </div>
            {parsed.rows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className="bg-bg text-xs uppercase tracking-wide text-muted"><tr><th className="px-3 py-2">{t("Ligne", "Row")}</th><th className="px-3 py-2">{t("Nom", "Name")}</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">{t("Téléphone", "Phone")}</th><th className="px-3 py-2">{t("Lieu", "Location")}</th><th className="px-3 py-2">{t("Compétences", "Skills")}</th><th className="px-3 py-2">{t("H/sem.", "H/wk")}</th><th className="px-3 py-2">{t("Action", "Action")}</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {parsed.rows.slice(0, 10).map((r) => (
                      <tr key={r.rowNumber}><td className="px-3 py-2 text-muted">{r.rowNumber}</td><td className="px-3 py-2">{r.full_name}</td><td className="px-3 py-2">{r.staff_code ?? "—"}</td><td className="px-3 py-2">{r.phone ?? "—"}</td><td className="px-3 py-2">{[r.postal_code, r.city].filter(Boolean).join(" · ") || "—"}</td><td className="px-3 py-2">{r.skills.join(", ") || "—"}</td><td className="px-3 py-2">{r.weekly_hours ?? "—"}</td><td className="px-3 py-2">{r.action === "update" ? <span className="rounded bg-primary-soft px-1.5 py-0.5 text-xs font-medium text-primary">{t("Mise à jour", "Update")}</span> : <span className="rounded bg-success-soft px-1.5 py-0.5 text-xs font-medium text-success">{t("Création", "New")}</span>}{r.availability_status ? <span className="ml-1 inline-block align-middle"><AvailabilityBadge status={r.availability_status} /></span> : null}</td></tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 10 ? <p className="border-t border-line px-3 py-2 text-xs text-muted">{t(`Aperçu des 10 premières lignes valides sur ${parsed.rows.length}.`, `Preview of the first 10 valid rows out of ${parsed.rows.length}.`)}</p> : null}
              </div>
            ) : <Alert tone="danger">{t("Aucune ligne valide à importer.", "No valid rows to import.")}</Alert>}
            {parsed.warnings.length > 0 ? (
              <div>
                <h3 className="mb-1 text-sm font-semibold">{t(`Avertissements (${parsed.warnings.length}) — ces lignes sont importées quand même`, `Warnings (${parsed.warnings.length}) — these rows are still imported`)}</h3>
                <ul className="max-h-40 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
                  {parsed.warnings.slice(0, 100).map((i, k) => <li key={k} className="px-3 py-1.5"><span className="font-medium">{t("Ligne", "Row")} {i.rowNumber}</span> · {i.field} : {tm(i.message)}{i.raw ? <span className="text-muted"> ({i.raw})</span> : null}</li>)}
                </ul>
              </div>
            ) : null}
            {parsed.issues.length > 0 ? (
              <div>
                <h3 className="mb-1 text-sm font-semibold">{t(`Erreurs par ligne (${parsed.issues.length}) — lignes non importées`, `Errors by row (${parsed.issues.length}) — rows not imported`)}</h3>
                <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
                  {parsed.issues.slice(0, 200).map((i, k) => <li key={k} className="px-3 py-1.5"><span className="font-medium">{t("Ligne", "Row")} {i.rowNumber}</span> · {i.field} : {tm(i.message)}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={reset}>{t("Annuler", "Cancel")}</Button>
              {parsed.issues.length > 0 ? <Button variant="secondary" onClick={downloadErrors}><Download className="h-4 w-4" aria-hidden /> {t("Rapport d’erreurs", "Error report")}</Button> : null}
              <Button disabled={parsed.rows.length === 0} onClick={confirm}>{t(`Confirmer : ${created} création(s), ${willUpdate} mise(s) à jour`, `Confirm: ${created} new, ${willUpdate} updated`)}</Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {stage === "importing" ? (
        <Card>
          <CardHeader title={t("3. Import en cours", "3. Import in progress")} description={t("Ne fermez pas cette page.", "Do not close this page.")} />
          <CardBody className="space-y-3" aria-live="polite">
            <div className="h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label={t("Progression de l’import", "Import progress")}>
              <div className="h-full bg-primary transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <p className="text-sm text-muted">{t(`${progress.done} / ${progress.total} lignes traitées`, `${progress.done} / ${progress.total} rows processed`)}</p>
            <Button variant="outlineDanger" onClick={() => { cancelled.current = true; }}>{t("Interrompre après le lot en cours", "Stop after the current batch")}</Button>
          </CardBody>
        </Card>
      ) : null}

      {stage === "done" && summary ? (
        <Card>
          <CardHeader title={t("Import terminé", "Import complete")} />
          <CardBody className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {([[t("Lignes lues", "Rows read"), summary.total], [t("Créés", "Created"), summary.inserted], [t("Mis à jour", "Updated"), summary.updated], [t("Rejetés / en échec", "Rejected / failed"), summary.rejected], [t("Localisations vérifiées", "Locations verified"), summary.located]] as [string, number][]).map(([l, v]) => (
                <div key={l} className="rounded-lg border border-line p-3"><dt className="text-xs text-muted">{l}</dt><dd className="text-xl font-semibold">{v}</dd></div>
              ))}
            </dl>
            {summary.locationPending > 0 ? <Alert tone="warning">{t(`${summary.locationPending} staff n’ont pas pu être localisés : ils sont exclus des recherches par distance.`, `${summary.locationPending} staff could not be located: they are excluded from distance searches.`)}</Alert> : null}
            {serverFailures.length > 0 ? (
              <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
                {serverFailures.slice(0, 100).map((f, k) => <li key={k} className="px-3 py-1.5">{t("Ligne", "Row")} {f.rowNumber} · {f.field} : {tm(f.message)}</li>)}
              </ul>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {allIssues.length > 0 ? <Button variant="secondary" onClick={downloadErrors}><Download className="h-4 w-4" aria-hidden /> {t("Rapport d’erreurs", "Error report")}</Button> : null}
              <Button variant="secondary" onClick={reset}><RotateCcw className="h-4 w-4" aria-hidden /> {t("Importer un autre fichier", "Import another file")}</Button>
              <Link href="/staff" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">{t("Voir le staff", "View staff")}</Link>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
