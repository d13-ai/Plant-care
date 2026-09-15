import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, radius, space, useTheme } from "@/theme";

const SHOW_FOR_MS = 6000;

export interface UndoOffer {
  message: string;
  undo: () => Promise<void> | void;
}

/**
 * One-tap actions (the water drop on a card, a Log button) deserve a way
 * back. `offer()` shows a bar for a few seconds with what just happened and
 * an Undo; the latest offer replaces the one before it.
 */
export function useUndo() {
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setOffer(null);
  }, []);

  const show = useCallback(
    (next: UndoOffer) => {
      if (timer.current) clearTimeout(timer.current);
      setOffer(next);
      timer.current = setTimeout(() => setOffer(null), SHOW_FOR_MS);
    },
    [],
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { offer, show, dismiss };
}

export function UndoBar({ offer, dismiss }: { offer: UndoOffer | null; dismiss: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  if (!offer) return null;
  const undo = async () => {
    dismiss();
    await offer.undo();
  };
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + space.md }]}>
      <View style={[styles.bar, { backgroundColor: t.plum, borderColor: t.hairline }]} accessibilityLiveRegion="polite">
        <Text style={[styles.text, { color: t.onPlum }]} numberOfLines={2}>
          {offer.message}
        </Text>
        <Pressable accessibilityRole="button" onPress={undo} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={[styles.undo, { color: t.goldText }]}>Undo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, alignItems: "center" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: 520,
    width: "100%",
  },
  text: { flex: 1, fontSize: 14, lineHeight: 19, fontFamily: font.regular },
  undo: { fontSize: 15, fontWeight: "700", fontFamily: font.bold },
});
