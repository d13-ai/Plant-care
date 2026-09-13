import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SpeciesField } from "@/components/species-field";
import { Body, Button, Card, Chips, Field, Heading } from "@/components/ui";
import { getPlant, updatePlant, type Plant, type PlantStatus } from "@/db";
import { SCHEDULED_CARE } from "@/domain/care";
import { space } from "@/theme";

type CadenceField = (typeof SCHEDULED_CARE)[number]["cadenceField"];

export default function EditPlant() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plantId = Number(id);

  const [plant, setPlant] = useState<Plant | null>(null);
  const [nickname, setNickname] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<PlantStatus>("ACTIVE");
  const [notes, setNotes] = useState("");
  const [cadence, setCadence] = useState<Record<CadenceField, string>>({
    waterEveryDays: "",
    fertilizeEveryDays: "",
    repotEveryDays: "",
    photoEveryDays: "",
  });

  useEffect(() => {
    getPlant(db, plantId).then((result) => {
      if (!result) return;
      const p = result.plant;
      setPlant(p);
      setNickname(p.nickname);
      setSpecies(p.species ?? "");
      setLocation(p.location ?? "");
      setStatus(p.status);
      setNotes(p.notes ?? "");
      setCadence({
        waterEveryDays: p.waterEveryDays ? String(p.waterEveryDays) : "",
        fertilizeEveryDays: p.fertilizeEveryDays ? String(p.fertilizeEveryDays) : "",
        repotEveryDays: p.repotEveryDays ? String(p.repotEveryDays) : "",
        photoEveryDays: p.photoEveryDays ? String(p.photoEveryDays) : "",
      });
    });
  }, [db, plantId]);

  if (!plant) return <View style={{ flex: 1 }} />;

  // Blank or zero turns a reminder off rather than nagging every day.
  const days = (value: string) => {
    const n = Number(value.trim());
    return value.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  const save = async () => {
    if (!nickname.trim()) return;
    await updatePlant(db, plantId, {
      nickname,
      species,
      location,
      status,
      notes,
      waterEveryDays: days(cadence.waterEveryDays),
      fertilizeEveryDays: days(cadence.fertilizeEveryDays),
      repotEveryDays: days(cadence.repotEveryDays),
      photoEveryDays: days(cadence.photoEveryDays),
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Name" value={nickname} onChangeText={setNickname} />
          <SpeciesField
            value={species}
            onChangeText={setSpecies}
            onPick={(entry) =>
              setCadence((prev) => ({
                ...prev,
                waterEveryDays: String(entry.waterEveryDays),
                fertilizeEveryDays: String(entry.fertilizeEveryDays),
                repotEveryDays: String(entry.repotEveryDays),
              }))
            }
          />
          <Field label="Where it lives" value={location} onChangeText={setLocation} />
          <Body small muted>
            Status
          </Body>
          <Chips
            options={[
              { label: "Active", value: "ACTIVE" },
              { label: "Dormant", value: "DORMANT" },
              { label: "Deceased", value: "DECEASED" },
            ]}
            value={status}
            onChange={setStatus}
          />
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
        </Card>

        <Card>
          <Heading>Reminders</Heading>
          <Body small muted>
            Days between each kind of care. Blank turns that reminder off.
          </Body>
          {SCHEDULED_CARE.map((care) => (
            <Field
              key={care.cadenceField}
              label={`${care.label} every (days)`}
              value={cadence[care.cadenceField]}
              onChangeText={(value) => setCadence((prev) => ({ ...prev, [care.cadenceField]: value }))}
              keyboardType="number-pad"
            />
          ))}
        </Card>

        <Button title="Save" variant="primary" disabled={!nickname.trim()} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
});
