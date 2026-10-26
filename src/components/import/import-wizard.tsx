"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileUp, RotateCcw, FileSpreadsheet, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { finalizeImport, getExistingIdentifiers, importStaffBatch, type ImportRowFailure } from "@/actions/import";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/form";
import { AvailabilityBadge } from "@/components/ui/badge";
import { APP_CONFIG } from "@/config/app";
import { chunk } from "@/lib/concurrency";
import { errorReportCsv, importTemplateCsv, parseStaffCsv, type ImportParseResult, type RowIssue } from "@/lib/csv/import";
import { downloadCsv } from "@/lib/download";

type Stage = "choose" | "preview" | "importing" | "done";
type Summary = { total: number; inserted: number; rejected: number; located: number; locationPending: number };

export function ImportWizard({ defaultCountry }: { defaultCountry: string }) {
  const router = useRouter();
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
    if (f && !/\.csv$/i.test(f.name)) { setFileError("Choisissez un fichier .csv."); setFile(null); return; }
    if (f && f.size > APP_CONFIG.import.maxFileBytes) { setFileError(`Fichier trop volumineux (${(APP_CONFIG.import.maxFileBytes / 1024 / 1024).toFixed(0)} Mo maximum).`); setFile(null); return; }
    setFile(f);
  };

  const preview = async () => {
    if (!file) { setFileError("Choisissez d’abord un fichier."); return; }
    setParsing(true);
    setFileError(null);
    try {
      const text = await file.text();
      const ex = await getExistingIdentifiers();
      if (!ex.ok) { setFileError(ex.error); return; }
      const result = parseStaffCsv(text, { defaultCountry, existingCodes: ex.data?.codes, existingEmails: ex.data?.emails });
      if (result.missingRequired.length > 0) { setFileError(`Colonne obligatoire manquante : ${result.missingRequired.join(", ")}. Téléchargez le modèle CSV.`); return; }
      setParsed(result);
      setStage("preview");
    } catch {
      setFileError("Lecture du fichier impossible.");
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
    let inserted = 0, located = 0, pending = 0;
    const failures: ImportRowFailure[] = [];
    let done = 0;
    for (const b of batches) {
      if (cancelled.current) break;
      const r = await importStaffBatch(b);
      if (!r.ok || !r.data) {
        // Lot refusé en bloc : chaque ligne est signalée, rien n’est présumé importé.
        for (const row of b) failures.push({ rowNumber: row.rowNumber, field: "lot", message: r.ok ? "Réponse vide" : r.error });
      } else {
        inserted += r.data.inserted; located += r.data.located; pending += r.data.locationPending;
        failures.push(...r.data.failures);
      }
      done += b.length;
      setProgress({ done, total: parsed.rows.length });
    }
    const rejected = parsed.issues.map((i) => i.rowNumber).filter((v, i, a) => a.indexOf(v) === i).length + failures.length;
    const s: Summary = { total: parsed.totalRows, inserted, rejected, located, locationPending: pending };
    setServerFailures(failures);
    setSummary(s);
    await finalizeImport({ fileName: file?.name, totalRows: s.total, inserted, rejected, located, locationPending: pending });
    setStage("done");
    router.refresh();
    toast.success(`${inserted} staff importé(s)`);
  };

  const allIssues: RowIssue[] = [...(parsed?.issues ?? []), ...serverFailures.map((f) => ({ rowNumber: f.rowNumber, field: f.field, message: f.message }))];
  const downloadErrors = () => downloadCsv("rapport-erreurs-import.csv", errorReportCsv(allIssues));
  const issueRows = new Set((parsed?.issues ?? []).map((i) => i.rowNumber)).size;

  return (
    <div className="space-y-6">
      {stage === "choose" ? <>
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-soft/70 via-surface to-surface p-5 sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-surface px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"><FileSpreadsheet className="h-3.5 w-3.5" /> Import CSV</div><h2 className="text-2xl font-semibold tracking-tight">Importez votre équipe en quelques étapes.</h2><p className="mt-2 text-sm leading-6 text-muted">Téléchargez le modèle, complétez les colonnes utiles, puis vérifiez l’aperçu avant l’enregistrement. Rien n’est ajouté tant que vous n’avez pas confirmé.</p></div>
            <Button variant="secondary" onClick={() => downloadCsv("modele-import-staff.csv", importTemplateCsv())}><Download className="h-4 w-4" /> Télécharger le modèle</Button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-line bg-surface p-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary"><Download className="h-4 w-4" /></span><p className="mt-3 text-sm font-semibold">1. Télécharger</p><p className="mt-1 text-xs leading-5 text-muted">Utilisez les en-têtes du modèle pour éviter les colonnes mal reconnues.</p></div><div className="rounded-xl border border-line bg-surface p-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary"><FileSpreadsheet className="h-4 w-4" /></span><p className="mt-3 text-sm font-semibold">2. Compléter le CSV</p><p className="mt-1 text-xs leading-5 text-muted">Une ligne par personne. Le nom complet est obligatoire ; les autres informations peuvent rester vides.</p></div><div className="rounded-xl border border-line bg-surface p-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-success-soft text-success"><CheckCircle2 className="h-4 w-4" /></span><p className="mt-3 text-sm font-semibold">3. Vérifier et importer</p><p className="mt-1 text-xs leading-5 text-muted">Corrigez les lignes signalées, puis confirmez l’import en toute connaissance de cause.</p></div></div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface/80 p-3 text-xs leading-5 text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p><strong>Colonnes attendues :</strong> full_name (obligatoire), staff_code, phone, email, country_code, postal_code, city, region, skills, availability, notes. <strong>Formats :</strong> CSV UTF-8, 5 Mo maximum, jusqu’à 5 000 lignes par fichier.</p></div>
        </div>
      </> : null}
      {stage === "choose" ? (
        <Card>
          <CardHeader title="1. Choisir un fichier" description="Format .csv, 5 000 lignes maximum. Aucune ligne n’est enregistrée avant votre confirmation." />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => downloadCsv("modele-import-staff.csv", importTemplateCsv())}><Download className="h-4 w-4" aria-hidden /> Télécharger le modèle CSV</Button>
            </div>
            <Field id="csv-file" label="Fichier CSV" error={fileError ?? undefined} hint="Colonnes : full_name (obligatoire), staff_code, phone, email, country_code, postal_code, city, region, skills, availability, notes.">
              <input ref={inputRef} id="csv-file" type="file" accept=".csv,text/csv" onChange={onPick} className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-bg" />
            </Field>
            <p className="text-xs text-muted">Une colonne « owner_id » éventuelle est ignorée : les fiches sont toujours rattachées à votre compte. L’availability vide ou inconnue reste « Inconnue », jamais « Disponible ».</p>
            <div className="flex flex-wrap justify-end gap-2">
              <LinkButton href="/staff" variant="ghost">Annuler</LinkButton>
              <Button pending={parsing} disabled={!file} onClick={preview}><FileUp className="h-4 w-4" aria-hidden /> Téléverser et prévisualiser</Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {stage === "preview" && parsed ? (
        <>
          <Card>
            <CardHeader title="2. Aperçu et validation" description={file?.name} />
            <CardBody className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-4">
                {[["Lignes lues", parsed.totalRows], ["Lignes valides", parsed.rows.length], ["Lignes rejetées", issueRows], ["Problèmes", parsed.issues.length]].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg border border-line p-3"><dt className="text-xs text-muted">{l}</dt><dd className="text-xl font-semibold">{v}</dd></div>
                ))}
              </dl>
              {parsed.truncated ? <Alert tone="warning">Le fichier dépasse {APP_CONFIG.import.maxRows} lignes : seules les {APP_CONFIG.import.maxRows} premières sont traitées. Découpez le fichier pour importer le reste.</Alert> : null}
              <div>
                <h3 className="mb-1 text-sm font-semibold">Correspondance des colonnes</h3>
                <ul className="flex flex-wrap gap-2 text-xs">
                  {parsed.headers.map((h) => <li key={h.original} className={`rounded-full px-2 py-1 ring-1 ring-inset ${h.mapped ? "bg-success-soft text-success ring-green-200" : "bg-gray-100 text-gray-600 ring-gray-200"}`}>{h.original} → {h.mapped ?? "ignorée"}</li>)}
                </ul>
              </div>
              {parsed.rows.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead className="bg-bg text-xs uppercase tracking-wide text-muted"><tr><th className="px-3 py-2">Ligne</th><th className="px-3 py-2">Nom</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Téléphone</th><th className="px-3 py-2">Lieu</th><th className="px-3 py-2">Dispo</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {parsed.rows.slice(0, 10).map((r) => (
                        <tr key={r.rowNumber}><td className="px-3 py-2 text-muted">{r.rowNumber}</td><td className="px-3 py-2">{r.full_name}</td><td className="px-3 py-2">{r.staff_code ?? "—"}</td><td className="px-3 py-2">{r.phone ?? "—"}</td><td className="px-3 py-2">{[r.postal_code, r.city, r.country_code].filter(Boolean).join(" · ")}</td><td className="px-3 py-2"><AvailabilityBadge status={r.availability_status} /></td></tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.rows.length > 10 ? <p className="border-t border-line px-3 py-2 text-xs text-muted">Aperçu des 10 premières lignes valides sur {parsed.rows.length}.</p> : null}
                </div>
              ) : <Alert tone="danger">Aucune ligne valide à importer.</Alert>}
              {parsed.issues.length > 0 ? (
                <div>
                  <h3 className="mb-1 text-sm font-semibold">Erreurs par ligne ({parsed.issues.length})</h3>
                  <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
                    {parsed.issues.slice(0, 200).map((i, k) => <li key={k} className="px-3 py-1.5"><span className="font-medium">Ligne {i.rowNumber}</span> · {i.field} : {i.message}</li>)}
                  </ul>
                  {parsed.issues.length > 200 ? <p className="mt-1 text-xs text-muted">Seules 200 erreurs sont affichées ; le rapport téléchargeable les contient toutes.</p> : null}
                </div>
              ) : null}
              <p className="text-xs text-muted">À l’import, chaque code postal distinct est géocodé une seule fois (concurrence bornée). Aucun itinéraire n’est calculé à l’import.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={reset}>Annuler</Button>
                {parsed.issues.length > 0 ? <Button variant="secondary" onClick={downloadErrors}><Download className="h-4 w-4" aria-hidden /> Télécharger le rapport d’erreurs</Button> : null}
                <Button disabled={parsed.rows.length === 0} onClick={confirm}>Confirmer l’import de {parsed.rows.length} ligne(s)</Button>
              </div>
            </CardBody>
          </Card>
        </>
      ) : null}

      {stage === "importing" ? (
        <Card>
          <CardHeader title="3. Import en cours" description="Ne fermez pas cette page." />
          <CardBody className="space-y-3" aria-live="polite">
            <div className="h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Progression de l’import">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <p className="text-sm text-muted">{progress.done} / {progress.total} lignes traitées</p>
            <Button variant="outlineDanger" onClick={() => { cancelled.current = true; }}>Interrompre après le lot en cours</Button>
          </CardBody>
        </Card>
      ) : null}

      {stage === "done" && summary ? (
        <Card>
          <CardHeader title="Import terminé" />
          <CardBody className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-4">
              {[["Lignes lues", summary.total], ["Importés", summary.inserted], ["Rejetés / en échec", summary.rejected], ["Localisations vérifiées", summary.located]].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border border-line p-3"><dt className="text-xs text-muted">{l}</dt><dd className="text-xl font-semibold">{v}</dd></div>
              ))}
            </dl>
            {summary.locationPending > 0 ? <Alert tone="warning">{summary.locationPending} staff importé(s) n’ont pas pu être localisés : ils sont exclus des recherches par distance. Relancez la résolution depuis l’annuaire.</Alert> : null}
            {serverFailures.length > 0 ? (
              <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
                {serverFailures.slice(0, 100).map((f, k) => <li key={k} className="px-3 py-1.5">Ligne {f.rowNumber} · {f.field} : {f.message}</li>)}
              </ul>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {allIssues.length > 0 ? <Button variant="secondary" onClick={downloadErrors}><Download className="h-4 w-4" aria-hidden /> Télécharger le rapport d’erreurs</Button> : null}
              <Button variant="secondary" onClick={reset}><RotateCcw className="h-4 w-4" aria-hidden /> Importer un autre fichier</Button>
              <Link href="/staff" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">Voir le staff importé</Link>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
