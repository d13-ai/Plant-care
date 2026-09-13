/**
 * Put the web build on GitHub Pages: `npm run deploy:pages`.
 *
 * Exports the app under the repo's subpath, adds what Pages needs, and
 * force-pushes it as the `gh-pages` branch (a build artifact — its history
 * is not worth keeping). The repo must be public, or on a plan that serves
 * Pages from private repos, and Pages set to deploy from `gh-pages`.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const out = (cmd, opts = {}) => execSync(cmd, { encoding: "utf8", ...opts }).trim();

const origin = out("git remote get-url origin");
const m = origin.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
if (!m) throw new Error(`origin isn't a GitHub repo: ${origin}`);
const [, owner, repo] = m;
const base = `/${repo}`;
const url = `https://${owner.toLowerCase()}.github.io${base}/`;
const head = out("git rev-parse --short HEAD");

const dist = path.resolve("dist-pages");
fs.rmSync(dist, { recursive: true, force: true });
console.log(`→ exporting web build with base path ${base}`);
sh(`npx expo export --platform web --output-dir dist-pages`, { env: { ...process.env, EXPO_BASE_URL: base } });

// Jekyll would drop the _expo/ folder; unknown routes fall back to the app shell.
fs.writeFileSync(path.join(dist, ".nojekyll"), "");
fs.copyFileSync(path.join(dist, "index.html"), path.join(dist, "404.html"));

const wt = fs.mkdtempSync(path.join(os.tmpdir(), "gh-pages-"));
try {
  console.log("→ committing to gh-pages");
  sh(`git worktree add --detach -q "${wt}" HEAD`);
  sh(`git checkout -q --orphan gh-pages`, { cwd: wt });
  sh(`git rm -rfq .`, { cwd: wt });
  // Keep the previous deploy's hashed bundles: a phone that cached the old
  // page shell still finds the JS it asks for instead of a blank screen.
  try {
    sh(`git fetch -q origin gh-pages`, { cwd: wt });
    sh(`git checkout -q origin/gh-pages -- _expo assets`, { cwd: wt });
  } catch {
    /* first deploy — nothing to keep */
  }
  fs.cpSync(dist, wt, { recursive: true });
  sh(`git add -A`, { cwd: wt });
  sh(`git commit -q -m "Web build for GitHub Pages (${head})"`, { cwd: wt });
  console.log("→ pushing");
  sh(`git push --force origin gh-pages`, { cwd: wt });
} finally {
  sh(`git worktree remove --force "${wt}"`);
  try { sh(`git branch -D -q gh-pages`); } catch {}
  fs.rmSync(dist, { recursive: true, force: true });
}
console.log(`\nDeployed ${head} → ${url}\n(Pages takes a minute or two to pick it up.)`);
