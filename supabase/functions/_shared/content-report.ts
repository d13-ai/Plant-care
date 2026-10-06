// Reporting a published page: a plant tag or a conservatory. Plain
// functions with no imports, so the edge function (report-content) and the
// tests (src/domain/content-report.test.ts) read the same rules.

export type ReportKind = "tag" | "conservatory";
export type ReportReason = "offensive" | "not_theirs" | "spam" | "other";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "offensive", label: "Offensive, sexual, violent or hateful" },
  { value: "not_theirs", label: "Uses my photos or writing, or shows me, without permission" },
  { value: "spam", label: "Spam or a scam" },
  { value: "other", label: "Something else" },
];

export const REPORT_NOTE_MAX = 1000;
/** From one network address in an hour, and across everybody in a day. */
export const REPORTS_PER_HOUR_PER_SOURCE = 5;
export const REPORTS_PER_DAY = 100;

const SITE_HOSTS = ["plantparlour.org", "www.plantparlour.org"];
const TOKEN = /^[a-f0-9]{32}$/;
const HANDLE = /^[A-Za-z0-9_]{3,20}$/;

/**
 * The page being reported, reduced to the one path that identifies it:
 * `/tag?t=<token>` or `/@handle`. Accepts the path itself or a full
 * plantparlour.org address. Anything else -- another site, another page of
 * ours, a malformed token -- is not something this form reports, and gets null.
 */
export function reportedPage(input: unknown): { kind: ReportKind; page: string } | null {
  if (typeof input !== "string" || input.length > 300) return null;
  let url: URL;
  try {
    url = new URL(input.trim(), "https://plantparlour.org");
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !SITE_HOSTS.includes(url.hostname)) return null;
  if (url.pathname === "/tag") {
    const t = url.searchParams.get("t") ?? "";
    return TOKEN.test(t) ? { kind: "tag", page: `/tag?t=${t}` } : null;
  }
  const at = /^\/@([^/]+)\/?$/.exec(url.pathname);
  if (at && HANDLE.test(decodeURIComponent(at[1]))) return { kind: "conservatory", page: `/@${decodeURIComponent(at[1])}` };
  return null;
}

export function isReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((r) => r.value === value);
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The email we get for each report. The note is a stranger's words: escaped, and labelled as theirs. */
export function reportEmail(r: { kind: ReportKind; page: string; reason: ReportReason; note: string | null; id: number }) {
  const where = r.kind === "tag" ? "plant tag" : "conservatory";
  const label = REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason;
  const url = `https://plantparlour.org${r.page}`;
  const subject = `Reported ${where}: ${label}`;
  const text = [
    `Someone reported a ${where} on PlantParlour (report #${r.id}).`,
    "",
    `Page: ${url}`,
    `Reason: ${label}`,
    `What they wrote: ${r.note ? r.note : "(nothing)"}`,
    "",
    "If it breaks the Terms, unpublish it (set plants.published_at to null) or remove the keeper's handle, then set content_reports.handled_at.",
  ].join("\n");
  const html = `<p>Someone reported a ${where} on PlantParlour (report #${r.id}).</p>
<p><strong>Page:</strong> <a href="${esc(url)}">${esc(url)}</a><br><strong>Reason:</strong> ${esc(label)}</p>
<p><strong>What they wrote:</strong></p><blockquote style="margin:0 0 12px;padding:8px 12px;border-left:3px solid #C9A24B;background:#F3ECDD;">${r.note ? esc(r.note).replace(/\n/g, "<br>") : "<em>(nothing)</em>"}</blockquote>
<p style="color:#5F4B5C;font-size:13px;">If it breaks the Terms, unpublish it (set plants.published_at to null) or remove the keeper's handle, then set content_reports.handled_at.</p>`;
  return { subject, text, html };
}
