import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Body } from "@/components/ui";
import { font, space, useTheme } from "@/theme";

/**
 * How to take the photo the AI reads best. Each line comes from a way a
 * real scan has gone wrong: a neighbour named instead of the plant, a
 * cultivar missed because the leaf edge wasn't in the frame, dust read as
 * silver variegation, a warm lamp read as a sick leaf.
 */
const TIPS = [
  "Wipe the leaves first. Dust reads as a grey film and hides the spots, early pest damage and colour changes a health check is looking for — on one plant it was mistaken for silver variegation.",
  "One plant, filling the frame. Keep neighbours out of shot — the AI will try to name whatever it can see.",
  "Daylight, no flash. Shoot away from a bright window so the leaves aren't silhouettes — and not at night under a lamp, which casts a colour a reader can't tell from the plant's own.",
  "Show a whole leaf flat to the camera, with its edge and the stem. Leaf margins and stem colour are what tell look-alike cultivars apart.",
  "Get the pot and the soil surface in — watering and drainage questions are answered from them.",
  "Add a close-up as a second or third photo: the spot itself, or the underside of a leaf for pests. All the photos go together, and a dated pair a few days apart lets the AI say whether something is spreading.",
];

export function PhotoTips({ open: openAtFirst = false }: { open?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(openAtFirst);
  return (
    <View style={[styles.wrap, { borderColor: t.hairline }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        hitSlop={6}
        style={styles.header}
      >
        <Text style={[styles.title, { color: t.label }]}>Tips for a clear scan</Text>
        <Text style={[styles.toggle, { color: t.muted }]}>{open ? "Hide" : "Show"}</Text>
      </Pressable>
      {open ? (
        <View style={{ gap: space.sm }}>
          {TIPS.map((tip, i) => (
            <View key={tip} style={styles.tip}>
              <Text style={[styles.number, { color: t.goldText }]}>{i + 1}</Text>
              <Body small style={{ flex: 1 } as never}>{tip}</Body>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, paddingTop: space.md, gap: space.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 28 },
  title: { fontFamily: font.serifBold, fontWeight: "700", fontSize: 12, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
  toggle: { fontFamily: font.bold, fontWeight: "700", fontSize: 13 },
  tip: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  number: { fontFamily: font.serifBold, fontWeight: "700", fontSize: 13, lineHeight: 18, width: 14 },
});
