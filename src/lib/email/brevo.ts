import "server-only";

/** Envoi d'e-mails transactionnels via l'API Brevo (clé BREVO_API_KEY, expéditeur validé EMAIL_FROM). */
export type EmailInput = { to: string; toName?: string; subject: string; html: string; text: string };
export type EmailResult = { ok: true } | { ok: false; reason: "not_configured" | "rejected" | "network" };

export const isEmailConfigured = () => Boolean(process.env.BREVO_API_KEY) && Boolean(process.env.EMAIL_FROM);

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  if (!isEmailConfigured()) return { ok: false, reason: "not_configured" };
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
      console.error(`[email] Brevo a refusé l'envoi : statut ${res.status} — ${detail || "sans détail"} (expéditeur : ${process.env.EMAIL_FROM})`);
      return { ok: false, reason: "rejected" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] échec réseau :", e instanceof Error ? e.name : "erreur");
    return { ok: false, reason: "network" };
  }
}
