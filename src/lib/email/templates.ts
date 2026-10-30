/**
 * Bilingual email templates (simple HTML, compatible with all email clients).
 * All dynamic data is escaped.
 */
export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]!);

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#0f1b2a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e3e9ef">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e3e9ef;font-weight:700;font-size:16px;color:#0878c0">Maneliza Care · Manecare</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6"><h1 style="margin:0 0 14px;font-size:20px">${esc(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e3e9ef;font-size:12px;color:#5b6b7c">Maneliza Care — automated message.</td></tr>
</table></td></tr></table></body></html>`;
}

export function loginCodeEmail(code: string, locale: "fr" | "en") {
  const fr = locale === "fr";

  const subject = fr
    ? `Votre code de connexion Manecare : ${code}`
    : `Your Manecare sign-in code: ${code}`;

  const intro = fr
    ? "Utilisez ce code pour terminer votre connexion. Il expire dans 10 minutes."
    : "Use this code to finish signing in. It expires in 10 minutes.";

  const warn = fr
    ? "Si vous n’êtes pas à l’origine de cette connexion, changez votre mot de passe immédiatement. Ne communiquez jamais ce code."
    : "If this wasn’t you, change your password right away. Never share this code.";

  const html = layout(
    fr ? "Code de connexion" : "Sign-in code",
    `<p>${esc(intro)}</p>
<p style="margin:22px 0;text-align:center">
<span style="display:inline-block;padding:14px 26px;background:#e6f3fc;border-radius:10px;font-size:32px;letter-spacing:8px;font-weight:700;color:#066aa9">${esc(code)}</span>
</p>
<p style="color:#5b6b7c;font-size:13px">${esc(warn)}</p>`
  );

  return { subject, html, text: `${intro}\n\n${code}\n\n${warn}` };
}

/**
 * Email sent to staff members (both languages included in the same message).
 */
export function documentExpiryEmail(p: {
  staffName: string;
  documentName: { fr: string; en: string };
  expiresOn: string;
  daysLeft: number;
  company: string;
}) {
  const expired = p.daysLeft < 0;

  const when = expired
    ? {
        fr: `a expiré le ${p.expiresOn}`,
        en: `expired on ${p.expiresOn}`,
      }
    : p.daysLeft === 0
    ? {
        fr: `expire aujourd’hui (${p.expiresOn})`,
        en: `expires today (${p.expiresOn})`,
      }
    : {
        fr: `expire le ${p.expiresOn} (dans ${p.daysLeft} jour(s))`,
        en: `expires on ${p.expiresOn} (in ${p.daysLeft} day(s))`,
      };

  const subject = expired
    ? `Document expiré / Document expired — ${p.documentName.en}`
    : `Document à renouveler / Document to renew — ${p.documentName.en}`;

  const fr = `Bonjour ${p.staffName}, votre document « ${p.documentName.fr} » ${when.fr}. Merci de nous transmettre une version à jour dès que possible afin de pouvoir continuer à vous proposer des missions.`;

  const en = `Hello ${p.staffName}, your document “${p.documentName.en}” ${when.en}. Please send us an up-to-date version as soon as possible so we can keep offering you assignments.`;

  const sign = `${p.company}`;

  const html = layout(
    expired
      ? "Document expiré / Document expired"
      : "Document à renouveler / Document to renew",
    `<p>${esc(fr)}</p>
<p style="color:#5b6b7c">${esc(en)}</p>
<p style="margin-top:22px">${esc(sign)}</p>`
  );

  return { subject, html, text: `${fr}\n\n${en}\n\n${sign}` };
}