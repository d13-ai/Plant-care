import { Linking, Platform } from "react-native";

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
  Linking.openURL(path).catch(() => {});
}
