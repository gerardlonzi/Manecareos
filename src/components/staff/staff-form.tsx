"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Clock3, MapPin, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { saveStaffDocument } from "@/actions/documents";
import { removeStaffPhoto, saveStaff, uploadStaffPhoto } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardBody } from "@/components/ui/card";
import { TwoColumn } from "@/components/ui/two-column";
import { Field, FormPage, Input, Textarea } from "@/components/ui/form";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePreferences } from "@/components/providers/preferences-provider";
import { LocationFields } from "@/components/location/location-fields";
import { NewStaffDocuments, isFilled, type DocEntries } from "@/components/staff/new-staff-documents";
import { PhotoField, type PhotoChange } from "@/components/staff/photo-field";
import { SkillPicker } from "@/components/staff/skill-picker";
import { useUnsavedWarning } from "@/components/use-unsaved-warning";
import { COUNTRY_LIST, countryName } from "@/config/countries";
import type { DocType } from "@/lib/documents";
import type { LocationStatus, Staff } from "@/lib/types";

const makeSchema = (t: (fr: string, en: string) => string) => z.object({
  full_name: z.string().trim().min(1, t("Le nom est obligatoire", "Name is required")).max(200),
  staff_code: z.string().max(50),
  phone: z.string().max(32),
  phone_country_code: z.string().length(2),
  email: z.string().max(254).refine((v) => !v.trim() || z.email().safeParse(v.trim()).success, t("Adresse e-mail invalide", "Invalid email address")),
  weekly_hours: z.string().max(6).refine((v) => !v.trim() || (Number.isFinite(Number(v.replace(",", "."))) && Number(v.replace(",", ".")) >= 0 && Number(v.replace(",", ".")) <= 168), t("Entre 0 et 168 heures", "Between 0 and 168 hours")),
  country_code: z.string().length(2, t("Choisissez un pays", "Choose a country")),
  postal_code: z.string().max(16),
  city: z.string().max(120),
  region: z.string().max(120),
  skills: z.string().max(1000),
  availability_status: z.enum(["available", "unavailable", "unknown"]),
  notes: z.string().max(4000),
});
type Values = z.infer<ReturnType<typeof makeSchema>>;

function inferPhoneCountry(phone: string | null | undefined, fallback: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return [...COUNTRY_LIST].sort((a, b) => b.dialCode.length - a.dialCode.length).find((c) => digits.startsWith(c.dialCode))?.code ?? fallback;
}
const newStaffCode = () => `STF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const empty = (country: string): Values => ({ full_name: "", staff_code: "", phone: "", phone_country_code: country, email: "", weekly_hours: "", country_code: country, postal_code: "", city: "", region: "", skills: "", availability_status: "unknown", notes: "" });

export function StaffForm({ staff, defaultCountry, timeZone, photoUrl, documents, docTypes }: { staff?: Staff; defaultCountry: string; timeZone: string; photoUrl?: string | null; documents?: React.ReactNode; docTypes?: DocType[] }) {
  const router = useRouter();
  const { t, tm, locale } = usePreferences();
  const schema = React.useMemo(() => makeSchema(t), [t]);
  const [pending, start] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [photo, setPhoto] = React.useState<PhotoChange>({ file: null, remove: false });
  const [docEntries, setDocEntries] = React.useState<DocEntries>({});
  const submitting = React.useRef(false);

  const initial: Values = staff ? {
    full_name: staff.full_name, staff_code: staff.staff_code ?? "", phone: staff.phone ?? "", phone_country_code: inferPhoneCountry(staff.phone, staff.country_code), email: staff.email ?? "",
    weekly_hours: staff.weekly_hours != null ? String(staff.weekly_hours) : "",
    country_code: staff.country_code, postal_code: staff.postal_code ?? "", city: staff.city ?? "", region: staff.region ?? "",
    skills: staff.skills.join(", "), availability_status: staff.availability_status, notes: staff.notes ?? "",
  } : empty(defaultCountry);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const { register, handleSubmit, setError, reset, setValue, watch, formState: { errors, isDirty } } = form;
  const phoneCountry = watch("phone_country_code");
  const fullName = watch("full_name");
  const skills = watch("skills");
  const availability = watch("availability_status");
  React.useEffect(() => { if (!staff && !form.getValues("staff_code")) setValue("staff_code", newStaffCode(), { shouldDirty: false }); }, [staff, form, setValue]);
  const photoDirty = photo.file !== null || photo.remove;
  useUnsavedWarning((isDirty || photoDirty) && !pending);

  const dialOptions = React.useMemo(() => COUNTRY_LIST.map((c) => ({ value: c.code, label: `+${c.dialCode}`, flag: c.code.toLowerCase(), description: countryName(c.code, locale), search: `${countryName(c.code, "fr")} ${countryName(c.code, "en")} ${c.code}` })), [locale]);
  const availOptions = [{ value: "available", label: t("Disponible", "Available"), dot: "green" as const }, { value: "unavailable", label: t("Indisponible", "Unavailable"), dot: "red" as const }, { value: "unknown", label: t("Inconnue", "Unknown"), dot: "amber" as const }];

  const submit = (another: boolean) => handleSubmit((values) => {
    if (submitting.current) return;
    submitting.current = true; setFormError(null);
    start(async () => {
      const r = await saveStaff(values, staff?.id);
      if (!r.ok) {
        submitting.current = false;
        setFormError(tm(r.error));
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) if (k in values) setError(k as keyof Values, { message: tm(m) });
        toast.error(tm(r.error));
        return;
      }
      const id = r.data?.id ?? staff?.id;
      if (id && photo.file) { const fd = new FormData(); fd.set("photo", photo.file); const pr = await uploadStaffPhoto(id, fd); if (!pr.ok) toast.error(tm(pr.error)); }
      else if (id && photo.remove && (staff?.photo_path || photoUrl)) await removeStaffPhoto(id);
      // Nouveau staff : les dates de documents saisies sont enregistrées (le fichier ou le lien se joint plus tard, c'est facultatif).
      let docsFailed = 0;
      if (!staff && id) {
        for (const [typeId, e] of Object.entries(docEntries)) {
          if (!isFilled(e)) continue;
          const fd = new FormData();
          fd.set("expires_at", e.date); fd.set("no_expiry", e.none ? "true" : "false");
          const dr = await saveStaffDocument(id, typeId, fd);
          if (!dr.ok) { docsFailed++; toast.error(tm(dr.error)); }
        }
      }
      const missingMandatory = (docTypes ?? []).filter((x) => x.mandatory && !x.archived_at && !isFilled(docEntries[x.id])).length;
      submitting.current = false;
      toast.success(tm(r.message ?? "Enregistré"));
      reset(values); setPhoto({ file: null, remove: false });
      if (another && !staff) { reset(empty(values.country_code)); setValue("staff_code", newStaffCode(), { shouldDirty: false }); setDocEntries({}); router.refresh(); return; }
      // Il manque encore des documents obligatoires (ou un enregistrement a échoué) : on ouvre la fiche pour les compléter.
      if (!staff && id && (missingMandatory > 0 || docsFailed > 0)) { toast.info(t("Complétez les documents obligatoires pour pouvoir assigner ce staff.", "Complete the mandatory documents so this staff member can be assigned.")); router.push(`/staff/${id}/edit#documents`); router.refresh(); return; }
      router.push(`/staff/${id}`); router.refresh();
    });
  });
  const cancel = () => (isDirty || photoDirty ? setConfirmCancel(true) : router.back());

  const section = (icon: React.ReactNode, title: string) => <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">{icon}{title}</h2>;

  return (
    <FormProvider {...form}>
      <FormPage width="xl">
        <form onSubmit={(e) => void submit(false)(e)} className="space-y-5 pb-4 mt-5" noValidate>
          {formError ? <Alert tone="danger">{formError}</Alert> : null}

          <TwoColumn
            left={<>
          <Card><CardBody>
            {section(<UserRound className="h-4 w-4 text-primary" aria-hidden />, t("Identité et contact", "Identity and contact"))}
            <div className="space-y-4">
              <PhotoField name={fullName} currentUrl={photoUrl} onChange={setPhoto} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="full_name" label={t("Nom complet", "Full name")} error={errors.full_name?.message} required className="sm:col-span-2"><Input id="full_name" autoComplete="off" aria-invalid={!!errors.full_name} {...register("full_name")} /></Field>
                <Field id="staff_code" label={t("Code staff", "Staff ID")} hint={t("Généré automatiquement.", "Generated automatically.")}><Input id="staff_code" readOnly className="bg-surface-2 font-mono text-muted" {...register("staff_code")} /></Field>
                <Field id="availability_status" label={t("Disponibilité", "Availability")} hint={t("« Inconnue » n’est jamais comptée comme disponible.", "Unknown is never counted as available.")}>
                  <input type="hidden" {...register("availability_status")} />
                  <SearchablePicker id="availability_status" value={availability} options={availOptions} onValueChange={(v) => setValue("availability_status", v as Values["availability_status"], { shouldDirty: true })} />
                </Field>
                <Field id="phone" label={t("Téléphone", "Phone")} error={errors.phone?.message} className="sm:col-span-2">
                  <div className="flex gap-2">
                    <input type="hidden" {...register("phone_country_code")} />
                    <SearchablePicker id="phone_country_code" className="w-36 shrink-0" value={phoneCountry} options={dialOptions} onValueChange={(v) => setValue("phone_country_code", v, { shouldDirty: true })} searchPlaceholder={t("Pays ou indicatif…", "Country or dial code…")} />
                    <Input id="phone" type="tel" autoComplete="tel-national" aria-invalid={!!errors.phone} placeholder={t("Numéro", "Number")} {...register("phone")} />
                  </div>
                </Field>
                <Field id="email" label="E-mail" error={errors.email?.message} className="sm:col-span-2"><Input id="email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register("email")} /></Field>
              </div>
            </div>
          </CardBody></Card>

          <Card><CardBody>
            {section(<MapPin className="h-4 w-4 text-primary" aria-hidden />, t("Localisation enregistrée", "Saved location"))}
            <LocationFields savedStatus={staff?.location_status as LocationStatus | undefined} verifiedAt={staff?.location_updated_at} timeZone={timeZone} />
          </CardBody></Card>

            </>}
            right={<>
          <Card><CardBody>
            {section(<Clock3 className="h-4 w-4 text-primary" aria-hidden />, t("Disponibilité de travail", "Working time"))}
            <Field id="weekly_hours" label={t("Heures de travail par semaine", "Working hours per week")} error={errors.weekly_hours?.message} hint={t("Facultatif. Ex. : 37,5", "Optional. E.g. 37.5")} className="max-w-xs">
              <div className="relative"><Input id="weekly_hours" inputMode="decimal" autoComplete="off" aria-invalid={!!errors.weekly_hours} className="pr-14" placeholder="37.5" {...register("weekly_hours")} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{t("h / sem.", "h / wk")}</span></div>
            </Field>
          </CardBody></Card>

          <Card><CardBody className="space-y-4">
            {section(<Sparkles className="h-4 w-4 text-primary" aria-hidden />, t("Compétences et notes", "Skills and notes"))}
            <Field id="skills-search" label={t("Compétences", "Skills")} error={errors.skills?.message} hint={t("Le libellé s’affiche dans votre langue (carer, support worker, RGN, nurse, chef, kitchen assistant, housekeeper…).", "Labels follow your language (carer, support worker, RGN, nurse, chef, kitchen assistant, housekeeper…).")}>
              <input type="hidden" {...register("skills")} />
              <SkillPicker value={skills} onChange={(v) => setValue("skills", v, { shouldDirty: true, shouldValidate: true })} />
            </Field>
            <Field id="notes" label="Notes" error={errors.notes?.message}><Textarea id="notes" rows={4} placeholder={t("Informations utiles pour l’équipe…", "Useful information for the team…")} {...register("notes")} /></Field>
          </CardBody></Card>
              <div id="documents" className="scroll-mt-40">
                <Card><CardBody>
                  {section(<ShieldCheck className="h-4 w-4 text-primary" aria-hidden />, t("Documents obligatoires", "Mandatory documents"))}
                  {staff ? documents : <NewStaffDocuments types={docTypes ?? []} value={docEntries} onChange={setDocEntries} />}
                </CardBody></Card>
              </div>
            </>}
          />

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-bg/90 px-1 py-3 backdrop-blur">
            <Button variant="ghost" onClick={cancel} disabled={pending}>{t("Annuler", "Cancel")}</Button>
            {!staff ? <Button variant="secondary" onClick={() => void submit(true)()} pending={pending}>{t("Enregistrer et ajouter un autre", "Save and add another")}</Button> : null}
            <Button type="submit" pending={pending}>{staff ? t("Enregistrer", "Save changes") : t("Enregistrer le staff", "Save staff")}</Button>
          </div>
        </form>
      </FormPage>
      <ConfirmDialog open={confirmCancel} title={t("Abandonner les modifications ?", "Discard changes?")} description={t("Les changements non enregistrés seront perdus.", "Unsaved changes will be lost.")}
        confirmLabel={t("Abandonner", "Discard")} cancelLabel={t("Continuer l’édition", "Keep editing")} destructive
        onCancel={() => setConfirmCancel(false)} onConfirm={() => { setConfirmCancel(false); reset(); setPhoto({ file: null, remove: false }); router.back(); }} />
    </FormProvider>
  );
}
