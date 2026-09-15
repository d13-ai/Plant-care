import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Body } from "@/components/ui";
import { font, space, useTheme } from "@/theme";

/**
 * How to take the photo the AI reads best. Each line comes from a way a
 * real scan has gone wrong: a neighbour named instead of the plant, a
 * cultivar missed because the leaf edge wasn't in the frame.
 */
const TIPS = [
  "One plant, filling the frame. Keep neighbours out of shot — the AI will try to name whatever it can see.",
  "Daylight, no flash. Shoot away from a bright window so the leaves aren't silhouettes.",
  "Show a whole leaf flat to the camera, with its edge and the stem. Leaf margins and stem colour are what tell look-alike cultivars apart.",
  "Get the pot and the soil surface in — watering and drainage questions are answered from them.",
  "For a problem, add a second photo close up: the spot itself, or the underside of the leaf for pests. Tap to focus; a sharp leaf beats a wide room.",
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
