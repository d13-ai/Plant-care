import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { ShareIcon } from "@/components/icons";
import { font, radius, space, useTheme } from "@/theme";

/**
 * iOS never offers to install a web app. Chrome on Android puts up its own
 * install banner; on an iPhone the only way in is Share → Add to Home Screen,
 * buried in a menu, so a visitor who doesn't already know the gesture just
 * gets a website they have to find in Safari every time.
 *
 * It sits on the welcome page, before sign-in, on purpose: a home-screen web
 * app doesn't share storage with Safari, so someone who signs in first and
 * installs afterwards has to sign in a second time inside the installed app.
 * Installing first makes that one sign-in the only one.
 */
function onIosBrowser(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  // iPadOS 13+ reports itself as a Mac; the touch points are what give it away.
  const ios =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!ios) return false;
  // Already on the home screen — there is nothing left to suggest.
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
  return !standalone;
}

export function InstallHint() {
  // Deliberately not computed during render. The web build is pre-rendered to
  // static HTML, where there is no navigator, so deciding at render time would
  // bake "not iOS" into the markup and mismatch when the real browser hydrates.
  const [show, setShow] = useState(false);
  useEffect(() => setShow(onIosBrowser()), []);
  const t = useTheme();

  if (!show) return null;
  return (
    <View style={[styles.hint, { borderColor: t.hairline }]}>
      <ShareIcon size={18} color={t.goldText} />
      <Text style={[styles.text, { color: t.muted }]}>
        <Text style={{ color: t.text }}>Keep it to hand. </Text>
        Tap Share, then Add to Home Screen, and the parlour opens like any other app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  text: { flex: 1, fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
});
