import "server-only";
import nodemailer from "nodemailer";

/** Envoi d'e-mails transactionnels via l'API Brevo (clé BREVO_API_KEY, expéditeur validé EMAIL_FROM). */
export type EmailInput = { to: string; toName?: string; subject: string; html: string; text: string };
export type EmailResult = { ok: true } | { ok: false; reason: "not_configured" | "rejected" | "network" };

/** Début et longueur de la clé, pour savoir laquelle est réellement lue (jamais la clé entière). */
const keyHint = (k?: string) => (k ? `${k.slice(0, 9)}… (${k.length} caractères${k !== k.trim() ? ", ESPACE parasite" : ""}${/["']/.test(k) ? ", GUILLEMETS" : ""})` : "aucune");

const smtpConfigured = () => Boolean(process.env.BREVO_SMTP_USER) && Boolean(process.env.BREVO_SMTP_KEY);

/** Deux modes : SMTP Brevo (BREVO_SMTP_USER + BREVO_SMTP_KEY, les mêmes identifiants que dans Supabase) ou API (BREVO_API_KEY). */
export const isEmailConfigured = () => (smtpConfigured() || Boolean(process.env.BREVO_API_KEY)) && Boolean(process.env.EMAIL_FROM);

async function sendViaSmtp(input: EmailInput): Promise<EmailResult> {
  try {
    const transport = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
      port: Number(process.env.BREVO_SMTP_PORT || 587),
      secure: Number(process.env.BREVO_SMTP_PORT || 587) === 465,
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
    const err = e as { code?: string; responseCode?: number; response?: string };
    console.error(`[email] SMTP Brevo refusé : ${err.code ?? "erreur"} ${err.responseCode ?? ""} ${(err.response ?? "").slice(0, 160)}`.trim());
    return { ok: false, reason: "rejected" };
  }
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  if (!isEmailConfigured()) return { ok: false, reason: "not_configured" };
  if (smtpConfigured()) return sendViaSmtp(input);
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
      // On ne journalise ni l'adresse ni le contenu : seulement le statut.
      let detail = "";
      try { const j = (await res.json()) as { code?: string; message?: string }; detail = `${j.code ?? ""} ${j.message ?? ""}`.trim(); } catch { /* corps non JSON */ }
      console.error(`[email] Brevo a refusé l'envoi : statut ${res.status} — ${detail || "sans détail"} (expéditeur : ${process.env.EMAIL_FROM}; clé lue : ${keyHint(process.env.BREVO_API_KEY)})`);
      return { ok: false, reason: "rejected" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] échec réseau :", e instanceof Error ? e.name : "erreur");
    return { ok: false, reason: "network" };
  }
}
