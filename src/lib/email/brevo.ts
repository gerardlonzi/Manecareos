import "server-only";
import nodemailer from "nodemailer";

/** Envoi d'e-mails transactionnels via Brevo : SMTP (BREVO_SMTP_USER + BREVO_SMTP_KEY) ou API (BREVO_API_KEY), expéditeur validé EMAIL_FROM. */
export type EmailInput = { to: string; toName?: string; subject: string; html: string; text: string };
export type EmailResult = { ok: true } | { ok: false; reason: "not_configured" | "rejected" | "network" };

const smtpConfigured = () => Boolean(process.env.BREVO_SMTP_USER) && Boolean(process.env.BREVO_SMTP_KEY);
const apiConfigured = () => Boolean(process.env.BREVO_API_KEY);

/** Deux modes : SMTP Brevo ou API. Si les deux sont renseignés, le SMTP est essayé d'abord, puis l'API en secours. */
export const isEmailConfigured = () => (smtpConfigured() || apiConfigured()) && Boolean(process.env.EMAIL_FROM);

/**
 * Indice de configuration SANS aucune partie de la clé : jamais de préfixe, de longueur ni d'empreinte dans les journaux.
 * Il signale seulement les erreurs de saisie courantes (espace, guillemets, clé SMTP collée dans la variable API).
 */
function configHint(): string {
  const k = process.env.BREVO_API_KEY;
  if (!k) return "BREVO_API_KEY absente";
  const issues: string[] = [];
  if (k !== k.trim()) issues.push("espace parasite");
  if (/["']/.test(k)) issues.push("guillemets");
  if (k.trim().startsWith("xsmtpsib-")) issues.push("c'est une clé SMTP : utilisez BREVO_SMTP_USER + BREVO_SMTP_KEY, ou créez une clé API xkeysib-");
  return issues.length ? `BREVO_API_KEY présente, à vérifier : ${issues.join(", ")}` : "BREVO_API_KEY présente";
}

async function sendViaSmtp(input: EmailInput): Promise<EmailResult> {
  try {
    const port = Number(process.env.BREVO_SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
      port,
      secure: port === 465,
      auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_KEY },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    });
    await transport.sendMail({
      from: { name: process.env.EMAIL_FROM_NAME || "Maneliza Care", address: process.env.EMAIL_FROM! },
      to: input.toName ? { name: input.toName, address: input.to } : input.to,
      subject: input.subject, html: input.html, text: input.text,
    });
    return { ok: true };
  } catch (e) {
    const err = e as { code?: string; responseCode?: number };
    // Ni adresse, ni contenu, ni identifiants : seulement le type d'erreur.
    console.error(`[email] SMTP Brevo refusé : ${err.code ?? "erreur"} ${err.responseCode ?? ""}`.trim());
    return { ok: false, reason: "rejected" };
  }
}

async function sendViaApi(input: EmailInput): Promise<EmailResult> {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || "Maneliza Care" },
        to: [{ email: input.to, name: input.toName || undefined }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      let detail = "";
      try { const j = (await res.json()) as { code?: string; message?: string }; detail = `${j.code ?? ""} ${j.message ?? ""}`.trim(); } catch { /* corps non JSON */ }
      console.error(`[email] API Brevo refusée : statut ${res.status} — ${detail || "sans détail"} (${configHint()})`);
      return { ok: false, reason: "rejected" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] échec réseau :", e instanceof Error ? e.name : "erreur");
    return { ok: false, reason: "network" };
  }
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  if (!isEmailConfigured()) return { ok: false, reason: "not_configured" };
  if (smtpConfigured()) {
    const smtp = await sendViaSmtp(input);
    // Un SMTP mal réglé ne doit pas bloquer tout l'envoi : on bascule sur l'API si une clé API est renseignée.
    if (smtp.ok || !apiConfigured()) return smtp;
    console.warn("[email] SMTP en échec, bascule sur l'API Brevo.");
  }
  return sendViaApi(input);
}