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
import { SurfaceContext, font, radius, space, useTheme, type Tone } from "@/theme";

/**
 * A cream card with the brand's double gold rule. Everything inside reads
 * the card palette. `style` is the card itself (colour, margins);
 * `contentStyle` lays out its children (a row, tighter padding).
 */
export function Card({
  children,
  style,
  contentStyle,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>
      <View style={[styles.cardInner, { borderColor: t.hairline }, contentStyle]}>
        <SurfaceContext.Provider value="card">{children}</SurfaceContext.Provider>
      </View>
    </View>
  );
}

/** Screen title — the big one at the top of the greenhouse. */
export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.title, { color: t.text }]}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.heading, { color: t.text }]}>{children}</Text>;
}

/** Small uppercase label above a section or strip. */
export function SectionLabel({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.sectionLabel, { color: t.label }]}>{children}</Text>;
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

export function Badge({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const t = useTheme();
  const colors = t[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      {icon}
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
  /** primary: gold. plum: filled plum, for logging. gold: outlined in gold. secondary: outlined. */
  variant?: "primary" | "secondary" | "danger" | "plum" | "gold";
  disabled?: boolean;
  small?: boolean;
}) {
  const t = useTheme();
  const look = {
    primary: { bg: t.primary, fg: t.onPrimary, border: t.primary },
    plum: { bg: t.plum, fg: t.onPlum, border: t.plum },
    gold: { bg: "transparent", fg: t.goldText, border: t.gold },
    danger: { bg: t.critical.bg, fg: t.critical.fg, border: t.critical.bg },
    secondary: { bg: "transparent", fg: t.text, border: t.surface === "card" ? t.plum : t.border },
  }[variant];
  const color = look.fg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: look.bg, borderColor: look.border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color }]}>{title}</Text>
    </Pressable>
  );
}

/** A round 44px action: filled when it's the thing to do now, outlined otherwise. */
export function IconButton({
  children,
  onPress,
  filled,
  label,
  disabled,
}: {
  children: ReactNode;
  onPress: () => void;
  filled?: boolean;
  label: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        filled
          ? { backgroundColor: t.dropFilledBg, borderColor: t.dropFilledBg }
          : { backgroundColor: "transparent", borderColor: t.dropRing },
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  trailing,
  ...input
}: { label: string; hint?: string; trailing?: ReactNode } & TextInputProps) {
  const t = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={t.muted}
          {...input}
          style={[
            styles.input,
            { color: t.text, borderColor: t.inputBorder, backgroundColor: t.input, flex: 1 },
            input.multiline && { minHeight: 80, textAlignVertical: "top" },
            input.style,
          ]}
        />
        {trailing}
      </View>
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
            <Text style={[styles.chipText, { color: selected ? t.onPrimary : t.text }]}>
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
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 3,
  },
  cardInner: {
    borderWidth: 1,
    borderRadius: radius.lg - 3,
    padding: space.md + 1,
    gap: space.md,
  },
  title: { fontSize: 34, lineHeight: 38, letterSpacing: -0.3, fontFamily: font.serif, fontWeight: "600" },
  heading: { fontSize: 17, lineHeight: 21, fontFamily: font.serif, fontWeight: "600" },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontFamily: font.serifBold,
    fontWeight: "700",
  },
  body: { fontSize: 15, lineHeight: 21, fontFamily: font.regular },
  small: { fontSize: 13, lineHeight: 18, fontFamily: font.regular },
  label: { fontSize: 13, fontFamily: font.medium, fontWeight: "600" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: { fontSize: 11, fontFamily: font.bold, fontWeight: "700" },
  button: {
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  buttonSmall: { paddingHorizontal: space.md, paddingVertical: 7 },
  buttonText: { fontSize: 15, fontFamily: font.bold, fontWeight: "700" },
  buttonTextSmall: { fontSize: 13 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: font.regular,
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: font.bold, fontWeight: "700" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" },
});
