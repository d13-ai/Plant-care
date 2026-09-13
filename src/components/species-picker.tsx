import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Chips, Heading } from "@/components/ui";
import {
  SPECIES,
  SPECIES_GROUPS,
  scientificName,
  searchSpecies,
  type SpeciesEntry,
} from "@/domain/species";
import { font, radius, space, useTheme } from "@/theme";

/**
 * Browse the catalogue instead of typing: a sheet with a search box, the
 * groups as chips, and the list. Tapping a plant hands the entry back.
 */
export function SpeciesPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (entry: SpeciesEntry) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("");

  const rows = useMemo(() => {
    if (query.trim().length >= 2) return searchSpecies(query, 40);
    return group ? SPECIES.filter((e) => e.group === group) : SPECIES;
  }, [query, group]);

  const pick = (entry: SpeciesEntry) => {
    onPick(entry);
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
            options={[{ label: "All", value: "" }, ...SPECIES_GROUPS.map((g) => ({ label: g, value: g }))]}
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
            <Text style={[styles.empty, { color: t.muted }]}>Nothing by that name — type it in the field instead.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => pick(item)}
              style={({ pressed }) => [styles.row, { borderTopColor: t.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.name, { color: t.text }]}>{item.common[0] ?? scientificName(item)}</Text>
                <Text style={[styles.sci, { color: t.muted }]}>
                  {item.common[0] ? scientificName(item) : item.group}
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
