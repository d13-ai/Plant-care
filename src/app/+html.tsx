import { ScrollViewStyleReset } from "expo-router/html";
import { ANALYTICS_INLINE } from "@/domain/analytics";
import type { PropsWithChildren } from "react";

/**
 * The document every web route renders into. Expo Router's static export
 * otherwise writes no <title>, so the tab and "Add to Home screen" would
 * show the URL instead of the app's name.
 *
 * Two audiences, two lines. `TITLE` is what a person sees in a search
 * result, so it leads with what they typed — plant care tracker, watering
 * reminders — rather than with the brand, which nobody is searching for
 * yet. `SOCIAL_TITLE` is what unfurls in a chat thread, where the brand
 * line does the work. Same page, different rooms.
 */
const TITLE = "PlantParlour — plant care tracker with watering reminders";
const SOCIAL_TITLE = "PlantParlour — a room for the plants you're proud of";
const DESCRIPTION =
  "Track every houseplant you keep: photos, watering and fertilising reminders set per plant, a full care history, and a record that goes with the plant when you trade or sell it. Free, works offline, no account needed to start.";
const SOCIAL_DESCRIPTION =
  "Every plant you keep, given the care and the credit it's due: what it is, what it needs today, and the whole story to hand on to whoever gets it next. Made by two plant people who'd rather share it than keep it to themselves.";

const SITE = "https://plantparlour.org";

/**
 * Structured data for the site itself. Every app route renders this same
 * document — they are one client-rendered application — so the description
 * here is the application's, not any particular screen's.
 */
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PlantParlour",
    url: `${SITE}/`,
    logo: `${SITE}/icon-512.png`,
    description:
      "PlantParlour keeps a care record for every houseplant you own — and the record belongs to the plant, so it travels with it when the plant changes hands.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PlantParlour",
    url: `${SITE}/`,
    inLanguage: "en",
    description: DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "PlantParlour",
    url: `${SITE}/`,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web, iOS, Android",
    browserRequirements: "Works in any modern browser; installs to the home screen",
    image: `${SITE}/og-image.png`,
    description: DESCRIPTION,
    featureList: [
      "Photograph each plant and identify it from the photo",
      "Per-plant reminders for watering, fertilising, repotting and a fresh photo",
      "A full care history that belongs to the plant, not the keeper",
      "Report an issue and record the treatment that fixed it",
      "Log a propagation so a cutting traces back to its mother plant",
      "Publish a plant's tag — its whole record — at a shareable link",
      "Works offline; syncs across phones once you sign in",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE}/`,
    },
  },
];

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>{TITLE}</title>
        <meta name="application-name" content="PlantParlour" />
        <meta name="apple-mobile-web-app-title" content="PlantParlour" />
        <meta name="theme-color" content="#2E1633" />
        {/* Added to the home screen, this is what gets an icon and opens
            chrome-free. Without the manifest iOS falls back to a screenshot
            of the page and Android scales up the favicon. */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* / is the welcome page, so it is the link people pass around: this is
            what unfurls in a chat thread, and it has to be in the markup rather
            than rendered by the bundle. */}
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="PlantParlour" />
        <meta property="og:title" content={SOCIAL_TITLE} />
        <meta property="og:description" content={SOCIAL_DESCRIPTION} />
        <meta property="og:url" content={`${SITE}/`} />
        <meta property="og:image" content={`${SITE}/og-image.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="PlantParlour — a record for every plant you keep" />
        <meta name="twitter:card" content="summary_large_image" />
        {/* Every app route renders this one document and paints itself from
            the bundle, so to a crawler they are all the same page. Pointing
            them at / says so, instead of letting /account and /rounds
            compete with the front page for the same empty shell. The static
            pages under /plants and /parlour-games are real files and carry
            their own canonical. */}
        <link rel="canonical" href={`${SITE}/`} />
        {/* Counting, with the token stripped before anything is sent — see
            src/domain/analytics.ts. Every HTML surface carries this and the
            seo check fails if one of them stops. */}
        <script dangerouslySetInnerHTML={{ __html: ANALYTICS_INLINE }} />
        {JSON_LD.map((block) => (
          <script
            key={block["@type"]}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
          />
        ))}
        {/* The page is aubergine before the bundle paints, so there's no white flash. */}
        <style dangerouslySetInnerHTML={{ __html: "html,body,#root{background:#2E1633}" }} />
        <ScrollViewStyleReset />
        {/* Last-resort recovery: if nothing has rendered 20s after load
            (a genuinely broken bundle, not a slow one), fetch a fresh copy
            once. Long enough not to interrupt a slow mobile download. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){var r=document.getElementById('root');if(r&&r.children.length)return;try{if(sessionStorage.getItem('pp-reloaded'))return;sessionStorage.setItem('pp-reloaded','1');}catch(e){}location.replace(location.pathname+'?fresh='+Date.now());},20000);`,
          }}
        />
      </head>
      <body>
        {children}
        {/* Search crawlers run the bundle; most answer engines do not, and an
            empty <div id="root"> tells them nothing about what this is or
            where the rest of the site lives. This is the same claim the app
            makes, in markup, with the two links that matter. */}
        <noscript>
          <div style={{ padding: 24, color: "#F3ECDD", fontFamily: "Georgia, serif", maxWidth: 640 }}>
            <h1>PlantParlour</h1>
            <p>
              PlantParlour keeps a care record for every houseplant you own: a photo timeline, reminders for watering,
              fertilising and repotting set per plant, and every issue and treatment written down. The record belongs to
              the plant rather than to you, so when you trade or sell one its whole history goes with it, and a cutting
              traces back to the plant it came from.
            </p>
            <p>
              It runs in the browser and works offline. You can add plants without an account; signing in backs the
              greenhouse up and syncs it across phones.
            </p>
            <p>
              <a href="/plants" style={{ color: "#C9A24B" }}>
                Plant care library
              </a>{" "}
              &middot;{" "}
              <a href="/parlour-games" style={{ color: "#C9A24B" }}>
                Parlour Games
              </a>{" "}
              &middot;{" "}
              <a href="/privacy" style={{ color: "#C9A24B" }}>
                Privacy
              </a>{" "}
              &middot;{" "}
              <a href="/terms" style={{ color: "#C9A24B" }}>
                Terms
              </a>
            </p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
