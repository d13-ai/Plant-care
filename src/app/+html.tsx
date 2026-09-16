import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * The document every web route renders into. Expo Router's static export
 * otherwise writes no <title>, so the tab and "Add to Home screen" would
 * show the URL instead of the app's name.
 */
const TITLE = "PlantParlour — every plant, on the record";
const DESCRIPTION =
  "Keep every plant you own on the record: what it is, what it needs today, and everything that has happened to it. Made by two plant people who wanted their collection remembered properly — and yours too.";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>PlantParlour</title>
        <meta name="application-name" content="PlantParlour" />
        <meta name="apple-mobile-web-app-title" content="PlantParlour" />
        <meta name="theme-color" content="#2E1633" />
        {/* / is the welcome page, so it is the link people pass around: this is
            what unfurls in a chat thread, and it has to be in the markup rather
            than rendered by the bundle. */}
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="PlantParlour" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content="https://plantparlour.org/" />
        <meta name="twitter:card" content="summary" />
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
      <body>{children}</body>
    </html>
  );
}
