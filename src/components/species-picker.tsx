import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Chips, Heading } from "@/components/ui";
import {
  SPECIES,
  SPECIES_GROUPS,
  findSpecies,
  scientificName,
  searchSpecies,
  type SpeciesEntry,
} from "@/domain/species";
import { font, radius, space, useTheme } from "@/theme";

const CULTIVARS = "__cultivars__";

/**
 * Browse the catalogue instead of typing: a sheet with a search box, the
 * groups as chips, and the list. Tapping a plant hands the entry back.
 *
 * The catalogue will always be missing somebody's plant, so a search ends
 * with a way to keep the name as typed. Without it a near-miss was a dead
 * end: a keeper with a Monstera 'Burle Marx Flame' searched "burle marx",
 * was shown only the variegated philodendron, and had no way out of the
 * sheet but Close (15 Oct 2026).
 */
export function SpeciesPicker({
  visible,
  onClose,
  onPick,
  onUseTyped,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (entry: SpeciesEntry) => void;
  /** Keep the search text as the species, for a plant the list doesn't have. */
  onUseTyped?: (name: string) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("");

  const rows = useMemo(() => {
    if (query.trim().length >= 2) return searchSpecies(query, 40);
    if (group === CULTIVARS) return SPECIES.filter((e) => e.cultivar);
    return group ? SPECIES.filter((e) => e.group === group) : SPECIES;
  }, [query, group]);

  const pick = (entry: SpeciesEntry) => {
    onPick(entry);
    setQuery("");
    onClose();
  };

  // Offered once there is something to keep, and not when what was typed is
  // already a name the list knows -- then the row above it is the answer.
  const typed = query.trim().replace(/\s+/g, " ");
  const offerTyped = onUseTyped !== undefined && typed.length >= 2 && findSpecies(typed) === null;
  const useTyped = () => {
    onUseTyped?.(typed);
    setQuery("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.sheet, { backgroundColor: t.background, paddingTop: Math.max(insets.top, space.lg) }]}>
        <View style={styles.top}>
          <Heading>Pick a species</Heading>
          <Button title="Close" small onPress={onClose} />
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name — monstera, fiddle, snake…"
          placeholderTextColor={t.muted}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          style={[styles.search, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
        />
        {query.trim().length < 2 && (
          <Chips
            options={[
              { label: "All", value: "" },
              { label: "Variegated & cultivars", value: CULTIVARS },
              ...SPECIES_GROUPS.map((g) => ({ label: g, value: g })),
            ]}
            value={group}
            onChange={setGroup}
          />
        )}
        <FlatList
          data={rows}
          keyExtractor={scientificName}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: t.muted }]}>
              {offerTyped ? "Nothing by that name in the list." : "Nothing by that name — type it in the field instead."}
            </Text>
          }
          ListFooterComponent={
            offerTyped ? (
              <Pressable
                onPress={useTyped}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, { borderTopColor: t.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.name, { color: t.text }]}>Not here? Use “{typed}”</Text>
                  <Text style={[styles.sci, { color: t.muted }]}>
                    Saved as you typed it. Reminders start at water every 7 days; change them on the plant's Edit page.
                  </Text>
                </View>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => pick(item)}
              style={({ pressed }) => [styles.row, { borderTopColor: t.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.name, { color: t.text }]}>{item.common[0] ?? scientificName(item)}</Text>
                <Text style={[styles.sci, { color: t.muted }]}>
                  {item.common[0] ? scientificName(item) : item.cultivar ? `${item.genus} · cultivar` : item.group}
                  {" · water every "}
                  {item.waterEveryDays}d
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: space.lg, gap: space.md },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  search: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: font.regular,
  },
  row: { paddingVertical: 12, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: space.md },
  name: { fontSize: 15, fontFamily: font.bold, fontWeight: "700" },
  sci: { fontSize: 12, fontFamily: font.regular },
  empty: { paddingVertical: space.xl, textAlign: "center", fontSize: 13, fontFamily: font.regular, borderRadius: radius.md },
});
