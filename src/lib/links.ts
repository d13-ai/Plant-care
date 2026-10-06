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
