import { Pressable, StyleSheet, Text, View } from "react-native";
import { PipesIcon } from "@/components/icons";
import { openPage } from "@/lib/links";
import { font, radius, space, useTheme } from "@/theme";

/**
 * The way into Parlour Games from inside the app.
 *
 * It points at the hub rather than straight at Trickle. There is one game
 * today and a hub with one item costs a tap, but the link is going in the
 * greenhouse — the screen every keeper opens — and repointing it later
 * means a released build with a stale destination in it. The hub is the
 * address that stays right as games are added.
 *
 * Both faces are dressed like the games themselves rather than like the
 * plant cards: plum, gold, the pipe mark. Somewhere else, on purpose.
 */
const HUB = "/parlour-games";

/**
 * The prominent one, shown on the greenhouse only when nothing needs doing.
 * That is the moment a keeper opens the app, reads "all good" and closes it
 * again — the one place an invitation is an offer rather than an
 * interruption.
 */
export function GamesCard() {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Parlour Games"
      onPress={() => openPage(HUB)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.plum, borderColor: t.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <PipesIcon size={34} dry={t.dropRing} wet={t.leaf} node={t.gold} />
      <View style={styles.words}>
        <Text style={[styles.heading, { color: t.goldText }]}>Parlour Games</Text>
        <Text style={[styles.body, { color: t.onPlum }]}>
          Nothing needs you today. Sit down with a quiet puzzle for a minute.
        </Text>
      </View>
      <Text style={[styles.go, { color: t.goldText }]}>→</Text>
    </Pressable>
  );
}

/**
 * The quiet one, at the foot of the plant list. It is there on every visit,
 * so somebody who took the card once can find their way back without
 * waiting for a day when nothing is due.
 */
export function GamesLink() {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Parlour Games"
      hitSlop={8}
      onPress={() => openPage(HUB)}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.7 : 1 }]}
    >
      <PipesIcon size={16} dry={t.dropRing} wet={t.leaf} node={t.gold} />
      <Text style={[styles.linkText, { color: t.goldText }]}>Parlour Games</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  words: { flex: 1, gap: 2 },
  heading: { fontFamily: font.serif, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  go: { fontFamily: font.bold, fontSize: 18 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    // 44px tall including the text, so it is a real target on a phone.
    paddingVertical: 13,
  },
  linkText: { fontFamily: font.medium, fontSize: 14, lineHeight: 18 },
});
