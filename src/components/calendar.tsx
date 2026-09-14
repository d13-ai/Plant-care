import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Heading } from "@/components/ui";
import { font, radius, space, useTheme } from "@/theme";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * A month-grid date picker in a sheet. Works the same on web and on a phone.
 * Days after `maxDate` (default today) are disabled — you can't have acquired
 * a plant, or watered it, in the future. Hands back "YYYY-MM-DD".
 */
export function Calendar({
  visible,
  selected,
  maxDate = new Date(),
  onPick,
  onClose,
}: {
  visible: boolean;
  selected: Date | null;
  maxDate?: Date;
  onPick: (isoDate: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const today = new Date();
  const [cursor, setCursor] = useState(() => selected ?? today);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  const canGoNext = new Date(year, month + 1, 1) <= maxDate;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: t.card, borderColor: t.border }]} onPress={() => {}}>
          <View style={styles.header}>
            <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={10} style={styles.nav}>
              <Text style={[styles.navText, { color: t.primary }]}>‹</Text>
            </Pressable>
            <Heading>{`${MONTHS[month]} ${year}`}</Heading>
            <Pressable
              onPress={() => canGoNext && setCursor(new Date(year, month + 1, 1))}
              hitSlop={10}
              style={styles.nav}
            >
              <Text style={[styles.navText, { color: canGoNext ? t.primary : t.muted, opacity: canGoNext ? 1 : 0.4 }]}>›</Text>
            </Pressable>
          </View>

          <View style={styles.week}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={[styles.weekday, { color: t.muted }]}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`x${i}`} style={styles.cell} />;
              const disabled = day > maxDate;
              const isSelected = selected != null && sameDay(day, selected);
              const isToday = sameDay(day, today);
              return (
                <Pressable
                  key={ymd(day)}
                  disabled={disabled}
                  onPress={() => { onPick(ymd(day)); onClose(); }}
                  style={[
                    styles.cell,
                    styles.day,
                    isSelected && { backgroundColor: t.primary },
                    !isSelected && isToday && { borderColor: t.primary, borderWidth: 1.5 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: isSelected ? t.onPrimary : disabled ? t.muted : t.text, opacity: disabled ? 0.35 : 1 },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Button title="Today" small onPress={() => { onPick(ymd(today)); onClose(); }} />
            <Button title="Close" small onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: space.lg },
  sheet: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md, maxWidth: 380, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nav: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navText: { fontSize: 28, fontFamily: font.bold, fontWeight: "700", lineHeight: 30 },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 12, fontFamily: font.bold, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  day: { alignItems: "center", justifyContent: "center", borderRadius: 999 },
  dayText: { fontSize: 15, fontFamily: font.medium, fontWeight: "500" },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
});
