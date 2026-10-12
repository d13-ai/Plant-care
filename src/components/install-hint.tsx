import { useEffect, useState } from "react";
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ShareIcon } from "@/components/icons";
import { PLAY_STORE_URL } from "@/lib/links";
import { font, radius, space, useTheme } from "@/theme";

/**
 * How to get PlantParlour onto this phone, shown on the welcome page of the
 * web app, before sign-in.
 *
 * Android: it is on Google Play, so the browser is the wrong place to be --
 * GetItOnPlay puts Google's badge at the top of the page, under the
 * masthead, before the story they would otherwise have to scroll past.
 *
 * iPhone: iOS never offers to install a web app. Chrome on Android puts up its own
 * install banner; on an iPhone the only way in is Share → Add to Home Screen,
 * buried in a menu, so a visitor who doesn't already know the gesture just
 * gets a website they have to find in Safari every time.
 *
 * It sits on the welcome page, before sign-in, on purpose: a home-screen web
 * app doesn't share storage with Safari, so someone who signs in first and
 * installs afterwards has to sign in a second time inside the installed app.
 * Installing first makes that one sign-in the only one.
 */
type Hint = "ios" | "android" | null;

function whichHint(): Hint {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return null;
  // Already on the home screen — there is nothing left to suggest.
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
  if (standalone) return null;
  const ua = navigator.userAgent ?? "";
  if (/Android/i.test(ua)) return "android";
  // iPadOS 13+ reports itself as a Mac; the touch points are what give it away.
  const ios =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios ? "ios" : null;
}

/**
 * Deliberately not computed during render. The web build is pre-rendered to
 * static HTML, where there is no navigator, so deciding at render time would
 * bake "not iOS" into the markup and mismatch when the real browser hydrates.
 */
function useHint(): Hint {
  const [hint, setHint] = useState<Hint>(null);
  useEffect(() => setHint(whichHint()), []);
  return hint;
}

/** Android visitors to the web app: PlantParlour is on Google Play. */
export function GetItOnPlay() {
  const hint = useHint();
  const t = useTheme();
  if (hint !== "android") return null;
  return (
    <View style={[styles.hint, styles.android, { borderColor: t.hairline }]}>
      <Text style={[styles.text, { color: t.muted }]}>
        <Text style={{ color: t.text }}>On Android? </Text>
        PlantParlour is on Google Play.
      </Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Get it on Google Play"
        onPress={() => Linking.openURL(PLAY_STORE_URL).catch(() => {})}
      >
        {/* Google's own badge, unaltered; its transparent margin is the clear space it asks for. */}
        <Image source={{ uri: "/google-play-badge.png" }} style={styles.badge} resizeMode="contain" />
      </Pressable>
    </View>
  );
}

/** iPhone visitors: Share, then Add to Home Screen. */
export function InstallHint() {
  const hint = useHint();
  const t = useTheme();
  if (hint !== "ios") return null;
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
  android: { alignItems: "center" },
  badge: { width: 155, height: 60 },
});
