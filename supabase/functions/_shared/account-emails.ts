// The two emails an account gets: a welcome, and a link to reset a forgotten
// password. Plain functions with no imports, so the edge function can send
// them and vitest can read them (src/domain/account-emails.test.ts).
//
// Written like the rest of PlantParlour: say what is true, in plain words.
// No tracking pixels and no rewritten links -- click and open tracking are off
// on the plantparlour.org domain in Resend, which the privacy page promises,
// and which also keeps a reset link exactly as it was written.

export const SITE = "https://plantparlour.org";
export const FROM = "PlantParlour <hello@plantparlour.org>";
/** Replies go to the address already published on /privacy and /terms. */
export const REPLY_TO = "bondcreativestudios@gmail.com";

export interface Email {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The brand, as far as mail clients let it through: cream card, aubergine
// text, gold for the one button. Tables and inline styles because that is
// what Outlook and Gmail still read.
const C = { page: "#F3ECDD", card: "#FBF7EE", text: "#2E1633", muted: "#5F4B5C", gold: "#C9A24B", plum: "#4B2142" };

function frame(title: string, body: string, footer: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.card};border-radius:12px;">
<tr><td style="padding:32px 28px 8px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;color:${C.text};">PlantParlour</td></tr>
<tr><td style="padding:8px 28px 28px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:25px;color:${C.text};">
${body}
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;"><tr><td style="padding:16px 28px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:${C.muted};">
${footer}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="background:${C.gold};border-radius:8px;">
<a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:${C.text};text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** The trial is a function secret (AI_PHOTO_TRIAL), so the email reads it
 *  rather than repeating a number that can move without it. */
const photoChecksLine = (n: number) =>
  n >= 1
    ? `Your account comes with ${WORDS[n] ?? n} AI photo check${n === 1 ? "" : "s"}.`
    : "";

const p = (html: string) => `<p style="margin:0 0 14px;">${html}</p>`;

/**
 * Sent once, the first time someone signs in with a new account.
 *
 * Its job is the step most new keepers have not taken: both of the first two
 * who signed up stopped at an empty greenhouse. So it leads with the one
 * thing to do -- photograph a plant -- and then the two things that make the
 * app worth coming back to.
 */
export function welcomeEmail(photoChecks: number): Email {
  const subject = "Welcome to PlantParlour";
  const steps: [string, string][] = [
    [
      "Add your first plant with a photo.",
      `Take one of the whole plant and one close-up. We'll tell you what it is, down to the cultivar where we can, and how it's doing. ${photoChecksLine(photoChecks)}`.trim(),
    ],
    [
      "Tap the drop when you water.",
      "Each plant keeps its own schedule and tells you what it needs today. If the soil is still wet when watering comes round, press Still moist and we'll put it off for you.",
    ],
    [
      "Keep it on your home screen.",
      "On an iPhone: open plantparlour.org in Safari, tap Share, then Add to Home Screen. It opens like an app, and your plants follow you to any phone you sign into.",
    ],
  ];
  const html = frame(
    subject,
    [
      p("Your parlour is ready. Three things to get it going:"),
      `<ol style="margin:0 0 14px;padding-left:22px;">${steps
        .map(([head, body]) => `<li style="margin:0 0 12px;"><strong>${esc(head)}</strong> ${esc(body)}</li>`)
        .join("")}</ol>`,
      button(SITE, "Open your parlour"),
      p("Questions, ideas, or something that doesn't work? Reply to this email. It comes straight to us, and we read every one."),
      `<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;color:${C.plum};">David and Amanda</p>`,
    ].join("\n"),
    `You're getting this because an account was made at plantparlour.org with this address. If that wasn't you, reply and we'll remove it. <a href="${SITE}/privacy" style="color:${C.muted};">Privacy</a>`,
  );
  const text = [
    "Your parlour is ready. Three things to get it going:",
    "",
    ...steps.map(([head, body], i) => `${i + 1}. ${head} ${body}`),
    "",
    `Open your parlour: ${SITE}`,
    "",
    "Questions, ideas, or something that doesn't work? Reply to this email. It comes straight to us, and we read every one.",
    "",
    "David and Amanda",
    "",
    "--",
    "You're getting this because an account was made at plantparlour.org with this address. If that wasn't you, reply and we'll remove it.",
    `Privacy: ${SITE}/privacy`,
  ].join("\n");
  return { subject, html, text };
}

/**
 * Where a reset link points. The token rides in the query string of the
 * front page, which every build has, rather than on a route of its own, and
 * nothing is spent by opening it: the token is only used when the keeper
 * presses the button, so a mail scanner that fetches every link it sees
 * can't burn it first.
 */
export const resetLink = (tokenHash: string) => `${SITE}/?reset=${encodeURIComponent(tokenHash)}`;

export function resetEmail(address: string, tokenHash: string): Email {
  const subject = "Reset your PlantParlour password";
  const link = resetLink(tokenHash);
  const html = frame(
    subject,
    [
      p(`Someone, hopefully you, asked to reset the password for the PlantParlour account <strong>${esc(address)}</strong>.`),
      button(link, "Choose a new password"),
      p("The link works once, and only for a short while. If it has run out, ask for another from the sign-in page."),
      p("If you didn't ask for this, you can ignore it. Your password stays as it is, and nobody can change it without this email."),
      `<p style="margin:0;font-size:13px;line-height:20px;color:${C.muted};word-break:break-all;">If the button doesn't work, paste this into your browser:<br>${esc(link)}</p>`,
    ].join("\n"),
    `Sent by PlantParlour because a password reset was asked for at plantparlour.org. <a href="${SITE}/privacy" style="color:${C.muted};">Privacy</a>`,
  );
  const text = [
    `Someone, hopefully you, asked to reset the password for the PlantParlour account ${address}.`,
    "",
    `Choose a new password: ${link}`,
    "",
    "The link works once, and only for a short while. If it has run out, ask for another from the sign-in page.",
    "",
    "If you didn't ask for this, you can ignore it. Your password stays as it is, and nobody can change it without this email.",
  ].join("\n");
  return { subject, html, text };
}
