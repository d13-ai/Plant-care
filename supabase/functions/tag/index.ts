// Old tag links: GET /tag?t=<token> → the page on the web app.
//
// The tag page used to be rendered here, but Supabase Edge Functions rewrite
// text/html responses to text/plain (documented: they're for APIs, not
// pages), so browsers showed raw markup. The page now lives at
// api/tag.ts on Vercel; this keeps every link ever shared working.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://plant-care-flame.vercel.app";

Deno.serve((req: Request) => {
  const token = new URL(req.url).searchParams.get("t")?.trim() ?? "";
  const to = new URL("/tag", SITE_URL);
  if (token) to.searchParams.set("t", token);
  return Response.redirect(to.toString(), 302);
});
