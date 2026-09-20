// GET /privacy — what PlantParlour collects and who else sees it.
//
// Written from the actual data flows, not a template: the tables in
// supabase/migrations, the `plant-photos` bucket (public: true, hence the
// blunt paragraph about photo links), the analyze and care functions, and
// and the one counter the site does carry (see src/domain/analytics.ts,
// which strips a tag's token before any page view is reported).
import { CONTACT, ENTITY_FULL, legalPage, serve } from "./legal";

const sections = [
  {
    heading: "What we keep",
    html: `<ul>
<li><strong>Your account.</strong> Your email address, and either a password or your Google sign-in. Passwords are hashed by our authentication provider — we never see yours. If you sign in with Google we receive your email address and name, nothing else: not your Google password, not your contacts, not anything else in your Google account.</li>
<li><strong>Your plants.</strong> Whatever you put in: nicknames, species, when you acquired a plant and who from, notes, your care log, photos and their captions, and which plants came as cuttings from which.</li>
<li><strong>Your display name</strong>, and a handle if you claim one.</li>
<li><strong>A count of page views.</strong> Which pages get opened, and how often. See below.</li>
</ul>
<p class="muted">There is no advertising and there are no tracking pixels anywhere in PlantParlour. We set no cookies of our own. We do not buy information about you, and we do not sell or rent yours to anybody.</p>`,
  },
  {
    heading: "Counting page views",
    html: `<p>We count how many people open each page, using Vercel Web Analytics — Vercel already serve this site, so the counting happens where the site is already hosted rather than being handed to a third party. It is not linked to your account, and it does not follow you to other websites.</p>
<p><strong>Tag and conservatory links are deliberately blunted before anything is counted.</strong> A published tag lives at an address ending in a long random token, and that token is the whole of what makes the link work. Before a page view is reported, the address is stripped: the token goes, every other query string goes, and a handle or a plant's id is replaced by the shape of the page. So we can see that somebody opened a plant tag. We cannot see whose, and neither can Vercel.</p>
<p>What Vercel do with what they receive is set out in <a href="https://vercel.com/legal/privacy-policy">their privacy policy</a>.</p>`,
  },
  {
    heading: "Where it lives",
    html: `<p>Your records are stored in a Postgres database and file storage run by Supabase, hosted in the United States (US East). The site itself is served by Vercel. A copy of your plants is also kept on the device you use, so the app works when you have no signal.</p>`,
  },
  {
    heading: "About your photos",
    html: `<p>We want to be straight about this one. Photos are stored at long, random web addresses. Nobody can browse them and nobody can guess them — but <strong>anyone who has the address can open the photo without signing in</strong>. So a photo is unlisted rather than private.</p>
<p>In practice this only matters if a link escapes. Still: treat a photo the way you would treat an unlisted video. If you would mind a stranger seeing what is in the background, crop it or photograph the plant somewhere else.</p>`,
  },
  {
    heading: "What is public, and only when you say so",
    html: `<p>Nothing you keep is visible to anyone else until you choose to publish it.</p>
<ul>
<li><strong>Publishing a plant</strong> creates a tag link with 32 random characters in it. Anyone holding that link can read that one plant: its species, dates, notes, care history and photos. It is unlisted, not secret. Unpublishing stops the link working.</li>
<li><strong>Unlisted means we keep it out of search.</strong> Search engines are told not to list a tag page and not to index the photographs on it, and the crawlers that collect text to train AI models are refused it outright. What we cannot control is a link once you have sent it: anyone you give it to can pass it on, and a tag link posted somewhere public is public.</li>
<li><strong>Claiming a handle</strong> creates a conservatory page at plantparlour.org/@yourhandle. That page <em>is</em> public and meant to be found and shared. It shows only the plants you have already published, plus your display name and the date you joined. Because it is meant to be found, it is open to search engines and to AI crawlers in the ordinary way. If you would rather not be findable, publish plants without claiming a handle — the tag links work either way.</li>
</ul>
<p>Plants you have not published never appear on either, and are never shown to another keeper.</p>`,
  },
  {
    heading: "When you ask the AI",
    html: `<p>Identifying a plant from a photo, and generating a care guide, both use Anthropic's Claude API.</p>
<ul>
<li>Identifying sends <strong>the photos you chose</strong> to Anthropic. Generating a care guide sends <strong>the species name only</strong> — no photo, nothing about you.</li>
<li>Anthropic processes them to produce the answer. Under their commercial terms, inputs sent through the API are not used to train their models.</li>
<li>We record how many tokens each request used and what it cost, per day. We do not keep a copy of the conversation.</li>
<li>Care guides are cached and shared between keepers: the guide for a <em>Monstera deliciosa</em> is about the species, not about you or your plant, so the first keeper to ask generates it and everyone else reads the same one.</li>
</ul>`,
  },
  {
    heading: "Who else is involved",
    html: `<p>Four companies, each doing one job:</p>
<ul>
<li><strong>Supabase</strong> — stores your records and photos, and handles sign-in.</li>
<li><strong>Vercel</strong> — serves the website.</li>
<li><strong>Google</strong> — only if you choose to sign in with Google.</li>
<li><strong>Anthropic</strong> — only the photos or species names you send for analysis.</li>
</ul>
<p>Nobody else. We will not hand your records to anyone else unless the law genuinely requires it.</p>`,
  },
  {
    heading: "What you can do",
    html: `<ul>
<li><strong>Change or delete</strong> any plant, photo, note or care entry, whenever you like.</li>
<li><strong>Unpublish</strong> a plant, and its tag link stops working.</li>
<li><strong>Give up your handle</strong>, and the conservatory page goes with it.</li>
<li><strong>Delete your account entirely.</strong> Email <a href="mailto:${CONTACT}">${CONTACT}</a> from the address you signed up with and we will erase the account and everything in it — plants, photos, care history — within 30 days. There is no self-service button for this yet; we would rather say so than pretend otherwise.</li>
<li><strong>Ask for a copy</strong> of everything we hold on you, and we will send it.</li>
</ul>`,
  },
  {
    heading: "When you report a bug",
    html: `<p>While PlantParlour is still being tested there is a <strong>Report a bug</strong> button on your account screen. Pressing it sends us whatever you typed, plus a technical record of what the app was doing: which screens you opened, whether syncing was working, any errors it hit, your browser and screen size, and how many plants are on this device.</p>
<p>It does <em>not</em> send your photos, your notes, or what any of your plants are. Email addresses and access tokens are stripped out of that record before it leaves your device. Nothing is sent unless you press the button.</p>`,
  },
  {
    heading: "If something goes wrong",
    html: `<p>We take reasonable care to keep your records safe, but no system is perfect and we are not going to pretend otherwise. If your information is ever caught up in a security breach, we will tell you — by email, within 30 days of working out what happened, as Colorado law requires — and we will say what we know rather than what sounds best.</p>`,
  },
  {
    heading: "Children",
    html: `<p>PlantParlour is not intended for children under 13, and we do not knowingly keep information from them. If you believe a child has made an account, email us and we will remove it.</p>`,
  },
  {
    heading: "Changes",
    html: `<p>If we change how any of this works we will update this page and change the date at the top. If a change is significant, we will say so in the app rather than hoping you notice.</p>`,
  },
];

export default function handler(req: Parameters<typeof serve>[0], res: Parameters<typeof serve>[1]): void {
  serve(req, res, () =>
    legalPage(
      "Privacy",
      "PlantParlour is made by two people who keep plants. We built it for ourselves first, and we have tried to write this the way we would want it written for us: plainly, and without burying anything. PlantParlour is operated by <strong>" + ENTITY_FULL + "</strong>, which is responsible for the information described on this page.",
      sections,
      "What PlantParlour collects, where it is kept, what is public and who else can see it.",
    ),
  );
}
