import { Linking, Platform } from "react-native";

import { SITE_URL } from "@/lib/supabase";

/**
 * Opens a page that is part of plantparlour.org but not part of the app —
 * the games, the legal pages — in the same tab.
 *
 * `Linking.openURL` defaults to `_blank`, which is wrong for these: someone
 * who installed the app to their home screen gets thrown out into the
 * browser, and comes back to a cold start rather than the screen they left.
 * These are our own pages and they link back, so navigate in place.
 */
export function openPage(path: string): void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.assign(path);
    return;
  }
  Linking.openURL(siteUrl(path)).catch(() => {});
}

/**
 * A link to one of our own pages. On the web a path is enough and keeps the
 * visitor on whichever deployment they are on; in the Android or iOS app a
 * bare "/privacy" has no site to belong to and opens nothing, so it gets the
 * site in front.
 */
export function siteUrl(path: string): string {
  if (Platform.OS === "web" || !path.startsWith("/")) return path;
  return `${SITE_URL}${path}`;
}

/**
 * Opens one of our own pages *inside* the app: on Android and iOS a browser
 * sheet slides up over the greenhouse, and closing it (or the back button)
 * lands the keeper where they were. On the web this is openPage.
 *
 * For Parlour Games, which before this left the app for Chrome — and whose
 * way back, a link to the site, opened the web app signed out. `from=app`
 * tells the games they are in the sheet, so their PlantParlour links come
 * back to the app instead (public/parlour-games/harness.js, homeLinks).
 *
 * `createTask: false` keeps the sheet in the app's own task: the app coming
 * back to the front, by the close button or by that link, takes the sheet
 * away with it rather than leaving a stray browser in the recent apps.
 */
export async function openInApp(path: string): Promise<void> {
  if (Platform.OS === "web") return openPage(path);
  const url = `${siteUrl(path)}${path.includes("?") ? "&" : "?"}from=app`;
  try {
    const WebBrowser = await import("expo-web-browser");
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: "#2E1633",
      controlsColor: "#C9A249",
      showTitle: true,
      enableBarCollapsing: true,
      createTask: false,
    });
  } catch {
    // No browser that can show a sheet: the plain way still works.
    Linking.openURL(url).catch(() => {});
  }
}
