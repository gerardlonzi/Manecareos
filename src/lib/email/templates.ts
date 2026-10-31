/**
 * E-mail templates (English only, simple HTML compatible with all email clients).
 * All dynamic data is escaped.
 */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Logo shown at the top of every e-mail (150 px wide). Override with EMAIL_LOGO_URL; it must be a public https image. */
const DEFAULT_LOGO_URL = "https://yenwysnlhikusdsgjdtv.supabase.co/storage/v1/object/public/public_photos/maneliza-care-logo.png";
const logoUrl = () => process.env.EMAIL_LOGO_URL || DEFAULT_LOGO_URL;

function layout(title: string, bodyHtml: string, company: string): string {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#0f1b2a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e3e9ef">
<tr><td style="padding:22px 28px;border-bottom:1px solid #e3e9ef"><img src="${esc(logoUrl())}" alt="${esc(company)}" width="150" style="display:block;width:150px;max-width:150px;height:auto;border:0"></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6"><h1 style="margin:0 0 16px;font-size:21px;line-height:1.3">${esc(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e3e9ef;font-size:12px;line-height:1.5;color:#5b6b7c">${esc(company)} — this is an automated message about your compliance documents. Please do not share personal documents by anything other than the secure route your coordinator gives you.</td></tr>
</table></td></tr></table></body></html>`;
}

const longDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
};

/** E-mail sent to a staff member whose document has expired or is about to expire. */
export function documentExpiryEmail(p: {
  staffName: string;
  documentName: { fr: string; en: string };
  expiresOn: string;
  daysLeft: number;
  company: string;
}) {
  const doc = p.documentName.en;
  const date = longDate(p.expiresOn);
  const expired = p.daysLeft < 0;
  const today = p.daysLeft === 0;
  const days = Math.abs(p.daysLeft);
  const plural = (n: number) => (n === 1 ? "1 day" : `${n} days`);

  const status = expired
    ? `has expired (on ${date}, ${plural(days)} ago)`
    : today ? `expires today (${date})`
    : `will expire on ${date}, which is in ${plural(days)}`;

  const subject = expired
    ? `Action required: your ${doc} has expired`
    : today ? `Action required: your ${doc} expires today`
    : `Action required: your ${doc} expires on ${date}`;

  const headline = expired ? `Your ${doc} has expired` : `Your ${doc} is about to expire`;

  const intro = `Hello ${p.staffName}, we are writing because your ${doc} ${status}. ${p.company} must hold a valid, in-date copy of this document on your file at all times.`;

  const steps = [
    `Renew or obtain a new, valid ${doc} as soon as you can.`,
    `Send us a clear copy of the new document, together with its new expiry date, through the route your coordinator uses with you (for example by replying to this message or contacting your coordinator directly).`,
    `Wait for our confirmation that your file is up to date again. Your availability for new shifts resumes once it is.`,
  ];

  const risks = expired
    ? [
        "You cannot be offered or assigned to new shifts until a valid document is on file: our system blocks the assignment automatically.",
        "Shifts already planned for you may be put on hold, reviewed or given to another member of staff.",
        "Care homes and other clients require every worker to hold valid, in-date compliance documents. Without them, we cannot place you with them.",
        "For some documents, such as Right to Work and DBS checks, working without a valid one can breach legal or regulatory requirements for you and for the agency.",
        "The longer the document stays out of date, the more work and income you may miss.",
      ]
    : [
        `If the document is not renewed before ${date}, you will no longer be able to be assigned to new shifts, and shifts planned after that date may be reviewed or reassigned.`,
        "Care homes and other clients require every worker to hold valid, in-date compliance documents. Without them, we cannot place you with them.",
        "For some documents, such as Right to Work and DBS checks, working without a valid one can breach legal or regulatory requirements for you and for the agency.",
        "Renewals can take time. Starting now helps you avoid a gap in the work offered to you.",
      ];

  const accent = expired ? { bg: "#fdecec", border: "#f3b6b6", text: "#9b1c1c", label: "EXPIRED" } : { bg: "#fff4e0", border: "#f5d08a", text: "#8a5200", label: today ? "EXPIRES TODAY" : "EXPIRING SOON" };
  const li = (items: string[], ordered: boolean) => `<${ordered ? "ol" : "ul"} style="margin:8px 0 18px;padding-left:22px">${items.map((i) => `<li style="margin:0 0 7px">${esc(i)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;

  const html = layout(
    headline,
    `<p style="margin:0 0 16px">${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="background:${accent.bg};border:1px solid ${accent.border};border-radius:10px;padding:14px 16px;color:${accent.text}">
<div style="font-size:11px;font-weight:700;letter-spacing:.08em">${accent.label}</div>
<div style="font-size:16px;font-weight:700;margin-top:2px">${esc(doc)}</div>
<div style="font-size:14px;margin-top:2px">Expiry date: ${esc(date)}</div>
</td></tr></table>
<p style="margin:0;font-weight:700">What you need to do</p>${li(steps, true)}
<p style="margin:0;font-weight:700">What may happen if it is not updated</p>${li(risks, false)}
<p style="margin:0 0 6px">If you have already renewed this document, or you believe this message is a mistake, please let us know so we can update your file.</p>
<p style="margin:18px 0 0">Thank you,<br><strong>${esc(p.company)}</strong></p>`,
    p.company,
  );

  const text = [
    intro, "",
    `Document: ${doc}`, `Expiry date: ${date}`, "",
    "WHAT YOU NEED TO DO", ...steps.map((s, i) => `${i + 1}. ${s}`), "",
    "WHAT MAY HAPPEN IF IT IS NOT UPDATED", ...risks.map((r) => `- ${r}`), "",
    "If you have already renewed this document, or you believe this message is a mistake, please let us know so we can update your file.", "",
    `Thank you,`, p.company,
  ].join("\n");

  return { subject, html, text };
}