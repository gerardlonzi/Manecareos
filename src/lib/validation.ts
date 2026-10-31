import { z } from "zod";
import { WORKPLACE_VALUES } from "@/config/workplaces";
import { normalizeSkills } from "@/lib/utils";

const optText = (max: number) =>
  z.string().trim().max(max, `${max} caractères maximum`).optional().nullable().transform((v) => (v ? v : null));

const countryCode = z
  .string()
  .trim()
  .length(2, "Code pays sur 2 lettres")
  .regex(/^[A-Za-z]{2}$/, "Code pays invalide")
  .transform((v) => v.toUpperCase());

const skillsField = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .nullable()
  .transform((v) => normalizeSkills(v ?? []));

const emailField = z
  .string()
  .trim()
  .max(254)
  .optional()
  .nullable()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.email().safeParse(v).success, "Adresse e-mail invalide");

export const staffInputSchema = z.object({
  full_name: z.string().trim().min(1, "Le nom est obligatoire").max(200, "200 caractères maximum"),
  staff_code: optText(50),
  phone: optText(32),
  phone_country_code: countryCode.optional(),
  email: emailField,
  country_code: countryCode,
  postal_code: optText(16),
  city: optText(120),
  region: optText(120),
  skills: skillsField,
  availability_status: z.enum(["available", "unavailable", "unknown"]).default("unknown"),
  notes: optText(4000),
  weekly_hours: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number({ error: "Nombre invalide" }).min(0, "Minimum 0").max(168, "168 heures maximum par semaine").nullable()).default(null),
});
export type StaffInput = z.infer<typeof staffInputSchema>;

export const locationInputSchema = z.object({
  country_code: countryCode,
  postal_code: optText(16),
  city: optText(120),
  region: optText(120),
});

export const missionInputSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire").max(200, "200 caractères maximum"),
  mission_reference: optText(60),
  description: optText(4000),
  country_code: countryCode,
  postal_code: optText(16),
  city: optText(120),
  region: optText(120),
  required_skills: skillsField,
  required_staff_count: z.coerce.number({ error: "Nombre invalide" }).int("Nombre entier requis").min(1, "Au moins 1").max(1000, "1000 maximum"),
  scheduled_start_local: optText(16),
  scheduled_end_local: optText(16),
  planned_hours: optText(8),
  workplace_type: z.enum(WORKPLACE_VALUES).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  workplace_name: optText(120),
  pay_rate: optText(10),
  pay_currency: z.enum(["GBP", "EUR", "USD"]).default("GBP"),
  transport_mode: z.enum(["driving", "walking", "cycling", "public_transport"]).default("driving"),
  notes: optText(4000),
  intent: z.enum(["draft", "open"]).default("open"),
});
export type MissionInput = z.infer<typeof missionInputSchema>;

export const uuidSchema = z.uuid("Identifiant invalide");
export const uuidList = (max = 500) => z.array(z.uuid()).min(1, "Aucun élément sélectionné").max(max, `${max} éléments maximum`);

export function fieldErrorsFrom(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
