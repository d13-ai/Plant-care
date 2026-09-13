import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SpeciesField } from "@/components/species-field";
import { Badge, Body, Button, Card, Chips, Field, Heading, Row } from "@/components/ui";
import { createPlant, listPlants, type Plant } from "@/db";
import { findSpecies, matchCandidate, scientificName, type SpeciesEntry } from "@/domain/species";
import { analyzePhoto, type Verdict } from "@/lib/ai";
import { parseDate } from "@/lib/dates";
import { capturePhoto } from "@/lib/photos";
import { supabaseConfigured } from "@/lib/supabase";
import { radius, space, useTheme } from "@/theme";

export default function NewPlant() {
  const t = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [species, setSpecies] = useState("");
  const [picked, setPicked] = useState<SpeciesEntry | null>(null);
  const [location, setLocation] = useState("");
  const [acquiredFrom, setAcquiredFrom] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");
  const [motherId, setMotherId] = useState<string>("");
  const [candidates, setCandidates] = useState<Plant[]>([]);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const identify = async () => {
    if (!photoUri) return;
    setAnalyzing(true);
    setAiError(null);
    try {
      const { verdict: v } = await analyzePhoto(photoUri, { mode: "both" });
      setVerdict(v);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const useCandidate = (c: Verdict["species"][number]) => {
    // The catalogue's spelling when it knows this plant (down to the cultivar); the AI's otherwise.
    const typed = `${c.genus}${c.species ? ` ${c.species}` : ""}${c.cultivar ? ` '${c.cultivar}'` : ""}`;
    const entry = matchCandidate(c);
    const known = entry && scientificName(entry).toLowerCase() === typed.toLowerCase();
    setSpecies(known ? scientificName(entry) : typed);
    setPicked(entry);
  };

  useEffect(() => {
    listPlants(db).then((rows) => setCandidates(rows.map((r) => r.plant)));
  }, [db]);

  const acquiredIso = parseDate(acquiredAt);
  const dateInvalid = acquiredAt.trim() !== "" && !acquiredIso;

  const save = async () => {
    if (!nickname.trim() || dateInvalid) return;
    setSaving(true);
    const entry = picked ?? findSpecies(species);
    const id = await createPlant(db, {
      nickname,
      species: entry ? scientificName(entry) : species,
      location,
      acquiredFrom,
      acquiredAt: acquiredIso,
      motherPlantId: motherId ? Number(motherId) : null,
      photoUri,
      waterEveryDays: entry?.waterEveryDays,
      fertilizeEveryDays: entry?.fertilizeEveryDays,
      repotEveryDays: entry?.repotEveryDays,
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
            {photoUri && supabaseConfigured ? (
              <Button title={analyzing ? "Looking…" : "Identify with AI"} variant="primary" disabled={analyzing} onPress={identify} />
            ) : null}
          </Row>
          {aiError ? (
            <Body small style={{ color: t.critical.fg } as never}>
              {aiError}
            </Body>
          ) : null}
          {verdict ? (
            <View style={{ gap: space.sm }}>
              {!verdict.is_plant ? (
                <Body small muted>That doesn't look like a plant to me — try a clearer photo.</Body>
              ) : (
                <>
                  <Body small muted>Looks like — tap one to use it:</Body>
                  <Row>
                    {verdict.species.map((c) => (
                      <Button
                        key={`${c.genus}-${c.species}-${c.cultivar}`}
                        small
                        title={`${c.common_name || `${c.genus} ${c.species}`.trim()}${c.cultivar ? ` '${c.cultivar}'` : ""} · ${Math.round(c.confidence * 100)}%`}
                        onPress={() => useCandidate(c)}
                      />
                    ))}
                  </Row>
                  {verdict.health.findings.length > 0 ? (
                    <View style={{ gap: space.xs }}>
                      <Row>
                        <Badge label={`Health: ${verdict.health.overall}`} tone={verdict.health.overall === "healthy" ? "success" : verdict.health.overall === "unwell" ? "critical" : verdict.health.overall === "watch" ? "warning" : "neutral"} />
                      </Row>
                      {verdict.health.findings.map((f) => (
                        <Body small key={f.observation}>
                          {f.observation} — {f.suggested_action}
                        </Body>
                      ))}
                    </View>
                  ) : null}
                  {verdict.notes ? <Body small muted>{verdict.notes}</Body> : null}
                </>
              )}
            </View>
          ) : null}
        </Card>

        <Card>
          <Field label="Name" value={nickname} onChangeText={setNickname} placeholder="Big Monstera" autoFocus />
          <SpeciesField value={species} onChangeText={(v) => { setSpecies(v); setPicked(null); }} onPick={setPicked} />
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
              Pick a mother plant if this is a cutting. Its tag will trace back to it.
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
