// Shared chrome for the two legal pages, /privacy and /terms.
//
// They are served here rather than as app routes for two reasons: the app is
// behind a sign-in wall, and Google's OAuth reviewer cannot sign in; and the
// app's HTML is a shell that renders client-side, so a crawler that runs no
// JavaScript would see an empty page. These are plain server-rendered HTML,
// readable by anyone and anything, and they reuse the tag page's `page()` so
// they cannot drift from the brand.
import { page } from "./tag";

export const SITE = "https://plantparlour.org";
/** Change this when the wording changes, not when the file is touched. */
export const UPDATED = "17 September 2026";
/** Both pages point here. It has to be a mailbox someone actually reads. */
export const CONTACT = "bondcreativestudios@gmail.com";
/**
 * The legal person behind PlantParlour. Named on both pages, because terms
 * that describe the operator as a couple of individuals invite an argument
 * that the individuals are the ones on the hook.
 */
export const ENTITY = "Bond Creative Studios, LLC";

type Section = { heading: string; html: string };

/** Renders one legal page: masthead, dated intro, sections, footer. */
export function legalPage(
  title: string,
  intro: string,
  sections: Section[],
  description: string,
): { status: number; html: string } {
  const head = `<meta name="description" content="${description}">
<link rel="canonical" href="${SITE}/${title === "Privacy" ? "privacy" : "terms"}">`;
  const body = `<div class="top">
  <h1>${title}</h1>
  <span class="brand">PlantParlour</span>
</div>
<p class="sub">Last updated ${UPDATED}</p>
<section><p>${intro}</p></section>
${sections
  .map((s) => `<section><h2 class="caps">${s.heading}</h2>${s.html}</section>`)
  .join("\n")}
<div class="foot">
  <span>Questions? <a href="mailto:${CONTACT}">${CONTACT}</a></span>
  <span><a href="${SITE}/">plantparlour.org</a></span>
</div>`;
  return page(`${title} · PlantParlour`, body, 200, head);
}

type Req = { method?: string };
type Res = {
  status(code: number): Res;
  setHeader(name: string, value: string): void;
  send(body: string): void;
};

/** Both routes are static text, so they cache hard at the edge. */
export function serve(
  req: Req,
  res: Res,
  build: () => { status: number; html: string },
): void {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET");
    res.status(405).send("Method not allowed");
    return;
  }
  const { status, html } = build();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.status(status).send(html);
}
