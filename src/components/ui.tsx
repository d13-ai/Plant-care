import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { radius, space, useTheme, type Tone } from "@/theme";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>
      {children}
    </View>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.heading, { color: t.text }]}>{children}</Text>;
}

export function Body({
  children,
  muted,
  small,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Text style={[small ? styles.small : styles.body, { color: muted ? t.muted : t.text }, style as never]}>
      {children}
    </Text>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const t = useTheme();
  const colors = t[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "secondary",
  disabled,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  small?: boolean;
}) {
  const t = useTheme();
  const background =
    variant === "primary" ? t.primary : variant === "danger" ? t.critical.bg : t.neutral.bg;
  const color =
    variant === "primary" ? t.onPrimary : variant === "danger" ? t.critical.fg : t.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & TextInputProps) {
  const t = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        {...input}
        style={[
          styles.input,
          { color: t.text, borderColor: t.border, backgroundColor: t.background },
          input.multiline && { minHeight: 80, textAlignVertical: "top" },
          input.style,
        ]}
      />
      {hint ? <Text style={[styles.small, { color: t.muted }]}>{hint}</Text> : null}
    </View>
  );
}

/** A row of mutually exclusive choices — species status, care type, mother plant. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? t.primary : t.neutral.bg,
                borderColor: selected ? t.primary : t.border,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: selected ? t.onPrimary : t.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  heading: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "500" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  button: {
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  buttonSmall: { paddingHorizontal: space.md, paddingVertical: 8 },
  buttonText: { fontSize: 15, fontWeight: "600" },
  buttonTextSmall: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" },
});
