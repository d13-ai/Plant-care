import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * The document every web route renders into. Expo Router's static export
 * otherwise writes no <title>, so the tab and "Add to Home screen" would
 * show the URL instead of the app's name.
 */
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
        <meta name="theme-color" content="#F3F6F1" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0F1613" media="(prefers-color-scheme: dark)" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
