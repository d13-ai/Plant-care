import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { font, useTheme } from "@/theme";

/**
 * A plant's thumbnail wrapped in a ring that fills as its next watering
 * approaches — full and red when it's due. The home screen's "water due"
 * strip is a row of these, soonest first.
 */
export function DueRing({
  uri,
  progress,
  color,
  label,
  size = 84,
  onPress,
}: {
  uri: string | null;
  /** 0 = just watered, 1 = due now. */
  progress: number;
  color: string;
  label: string;
  size?: number;
  onPress?: () => void;
}) {
  const t = useTheme();
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  const inset = 10;

  return (
    <Pressable onPress={onPress} style={[styles.wrap, { width: size }]} hitSlop={6}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={c} cy={c} r={r} stroke={t.border} strokeWidth={stroke} fill="none" />
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
            rotation={-90}
            origin={`${c}, ${c}`}
          />
        </Svg>
        {uri ? (
          <Image
            source={{ uri }}
            contentFit="cover"
            style={[styles.thumb, { top: inset, left: inset, width: size - inset * 2, height: size - inset * 2 }]}
          />
        ) : (
          <View
            style={[
              styles.thumb,
              { top: inset, left: inset, width: size - inset * 2, height: size - inset * 2, backgroundColor: t.neutral.bg },
            ]}
          />
        )}
      </View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 6 },
  thumb: { position: "absolute", borderRadius: 999 },
  label: { fontSize: 12, fontFamily: font.bold, fontWeight: "700" },
});
