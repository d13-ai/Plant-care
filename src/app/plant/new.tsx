import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Body, Button, Card, Chips, Field, Heading, Row } from "@/components/ui";
import { createPlant, listPlants, type Plant } from "@/db";
import { parseDate } from "@/lib/dates";
import { capturePhoto } from "@/lib/photos";
import { radius, space, useTheme } from "@/theme";

export default function NewPlant() {
  const t = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState("");
  const [acquiredFrom, setAcquiredFrom] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");
  const [motherId, setMotherId] = useState<string>("");
  const [candidates, setCandidates] = useState<Plant[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listPlants(db).then((rows) => setCandidates(rows.map((r) => r.plant)));
  }, [db]);

  const acquiredIso = parseDate(acquiredAt);
  const dateInvalid = acquiredAt.trim() !== "" && !acquiredIso;

  const save = async () => {
    if (!nickname.trim() || dateInvalid) return;
    setSaving(true);
    const id = await createPlant(db, {
      nickname,
      species,
      location,
      acquiredFrom,
      acquiredAt: acquiredIso,
      motherPlantId: motherId ? Number(motherId) : null,
      photoUri,
    });
    router.replace({ pathname: "/plant/[id]", params: { id: String(id) } });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Heading>Photo</Heading>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={[styles.photo, { backgroundColor: t.neutral.bg }]} />
          )}
          <Row>
            <Button title="Take photo" onPress={() => capturePhoto("camera").then((u) => u && setPhotoUri(u))} />
            <Button title="Choose from library" onPress={() => capturePhoto("library").then((u) => u && setPhotoUri(u))} />
          </Row>
        </Card>

        <Card>
          <Field label="Name" value={nickname} onChangeText={setNickname} placeholder="Big Monstera" autoFocus />
          <Field label="Species" value={species} onChangeText={setSpecies} placeholder="Monstera deliciosa" />
          <Field label="Where it lives" value={location} onChangeText={setLocation} placeholder="South window" />
          <Field label="Acquired from" value={acquiredFrom} onChangeText={setAcquiredFrom} placeholder="Local nursery, a friend, a trade" />
          <Field
            label="Acquired on"
            value={acquiredAt}
            onChangeText={setAcquiredAt}
            placeholder="YYYY-MM-DD (today if blank)"
            hint={dateInvalid ? "Use YYYY-MM-DD" : "Care reminders count from this date until you log something."}
            keyboardType="numbers-and-punctuation"
          />
        </Card>

        {candidates.length > 0 && (
          <Card>
            <Heading>Propagated from</Heading>
            <Body small muted>
              Pick a mother plant if this is a cutting. Its passport will trace back to it.
            </Body>
            <Chips
              options={[
                { label: "Not a cutting", value: "" },
                ...candidates.map((p) => ({ label: p.nickname, value: String(p.id) })),
              ]}
              value={motherId}
              onChange={setMotherId}
            />
          </Card>
        )}

        <Button
          title={saving ? "Saving…" : "Add plant"}
          variant="primary"
          disabled={!nickname.trim() || dateInvalid || saving}
          onPress={save}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md },
});
