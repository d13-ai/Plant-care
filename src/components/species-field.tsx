import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SpeciesPicker } from "@/components/species-picker";
import { Button, Field } from "@/components/ui";
import { displayName, findSpecies, sameName, scientificName, searchSpecies, type SpeciesEntry } from "@/domain/species";
import { font, space, useTheme } from "@/theme";

/**
 * The species box with suggestions from the catalogue underneath as you
 * type. Picking one fills the scientific name and hands the entry back so
 * the screen can set its reminders.
 */
export function SpeciesField({
  value,
  onChangeText,
  onPick,
  placeholder = "Monstera deliciosa",
}: {
  value: string;
  onChangeText: (value: string) => void;
  onPick: (entry: SpeciesEntry) => void;
  placeholder?: string;
}) {
  const t = useTheme();
  const [browsing, setBrowsing] = useState(false);
  const matched = useMemo(() => findSpecies(value), [value]);
  // A nickname ("thai con", "pothos") is understood, but still offered as a
  // chip so one tap turns it into the proper name.
  const canonical = matched !== null && sameName(value, scientificName(matched));
  const suggestions = useMemo(
    () => (canonical ? [] : matched ? [matched] : searchSpecies(value)),
    [value, matched, canonical],
  );

  return (
    <View style={{ gap: space.sm }}>
      <Field
        label="Species"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        trailing={<Button title="Browse" small onPress={() => setBrowsing(true)} />}
        hint={
          matched
            ? `${matched.common[0] ? `${matched.common[0]} · ` : ""}reminders set: water every ${matched.waterEveryDays} days, feed every ${matched.fertilizeEveryDays}`
            : "Start typing for suggestions, or browse the list."
        }
      />
      <SpeciesPicker
        visible={browsing}
        onClose={() => setBrowsing(false)}
        onPick={(entry) => {
          onChangeText(scientificName(entry));
          onPick(entry);
        }}
      />
      {suggestions.length > 0 && (
        <View style={styles.list}>
          {suggestions.map((entry) => (
            <Pressable
              key={scientificName(entry)}
              onPress={() => {
                onChangeText(scientificName(entry));
                onPick(entry);
              }}
              style={({ pressed }) => [
                styles.item,
                { backgroundColor: t.neutral.bg, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.itemText, { color: t.text }]}>{displayName(entry)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  item: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  itemText: { fontSize: 13, fontFamily: font.bold, fontWeight: "700" },
});
