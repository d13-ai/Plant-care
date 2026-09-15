// After `expo export`, rename the dynamic-route pages so Vercel can rewrite
// to them: `/plant/[id].html` becomes `/plant/_id.html` and the edit page
// `/plant/_id/edit.html`. Vercel's rewrites never matched a destination
// with square brackets, so a direct load of /plant/12 (a reload, a tap that
// left the app, a bookmark) was a 404. Usage: node scripts/flatten-routes.mjs dist
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? "dist";
const renames = [
  ["plant/[id].html", "plant/_id.html"],
  ["plant/[id]", "plant/_id"],
];
for (const [from, to] of renames) {
  const src = path.join(root, from);
  const dest = path.join(root, to);
  if (!fs.existsSync(src)) throw new Error(`expected ${src} in the export`);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(src, dest);
  console.log(`${from} -> ${to}`);
}
