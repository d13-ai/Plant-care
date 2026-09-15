import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SpeciesField } from "@/components/species-field";
import { Badge, Body, Button, Card, Chips, Field, Heading, Row } from "@/components/ui";
import { createPlant, listPlants, logCare, type Plant } from "@/db";
import { findSpecies, matchCandidate, scientificName, type SpeciesEntry } from "@/domain/species";
import { scanSummary } from "@/domain/scan";
import { analyzePhoto, describeCost, type Verdict } from "@/lib/ai";
import { clearDraft, loadDraft, saveDraftSoon } from "@/lib/draft";
import { Calendar } from "@/components/calendar";
import { PhotoTips } from "@/components/photo-tips";
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
  const [pickingDate, setPickingDate] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  // Don't overwrite a saved draft with the empty form before it's been read back.
  const hydrated = useRef(false);

  // Whatever was here last time comes back — the photo, the AI's answer, the
  // typed fields — so backing out by accident costs nothing.
  useEffect(() => {
    loadDraft().then((d) => {
      if (d) {
        setPhotoUri(d.photoUri);
        setNickname(d.nickname);
        setSpecies(d.species);
        setPicked(d.pickedName ? findSpecies(d.pickedName) : null);
        setLocation(d.location);
        setAcquiredFrom(d.acquiredFrom);
        setAcquiredAt(d.acquiredAt);
        setMotherId(d.motherId);
        setVerdict(d.verdict);
        setRestored(true);
      }
      hydrated.current = true;
    });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    saveDraftSoon({
      photoUri, nickname, species, pickedName: picked ? scientificName(picked) : null,
      location, acquiredFrom, acquiredAt, motherId, verdict,
    });
  }, [photoUri, nickname, species, picked, location, acquiredFrom, acquiredAt, motherId, verdict]);

  const startOver = async () => {
    await clearDraft();
    setPhotoUri(null); setNickname(""); setSpecies(""); setPicked(null); setLocation("");
    setAcquiredFrom(""); setAcquiredAt(""); setMotherId(""); setVerdict(null); setAiError(null);
    setRestored(false);
  };

  const identify = async () => {
    if (!photoUri) return;
    setAnalyzing(true);
    setAiError(null);
    try {
      // A species already typed or picked goes along as a hint: the AI then
      // confirms or corrects it rather than guessing among look-alikes.
      const answer = await analyzePhoto(photoUri, { mode: "both", speciesHint: species.trim() || null });
      setVerdict(answer.verdict);
      setScanNote(describeCost(answer));
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
    // The scan's health read goes into the record, not just the species name.
    if (verdict?.is_plant) await logCare(db, id, "AI_CHECK", { notes: scanSummary(verdict) });
    await clearDraft();
    router.replace({ pathname: "/plant/[id]", params: { id: String(id) } });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {restored ? (
          <Card>
            <Body small muted>Picked up where you left off — the photo, the AI's answer and what you'd typed are all here.</Body>
            <Row>
              <Button title="Start over" small onPress={startOver} />
            </Row>
          </Card>
        ) : null}
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
          {!verdict ? <PhotoTips open={!photoUri} /> : null}
          {verdict ? (
            <View style={{ gap: space.sm }}>
              {!verdict.is_plant ? (
                <Body small muted>That doesn't look like a plant to me — try a clearer photo.</Body>
              ) : (
                <>
                  <Body small muted>Looks like — tap one to use it:</Body>
                  <View style={{ gap: space.sm }}>
                    {[...verdict.species]
                      .sort((a, b) => b.confidence - a.confidence)
                      .map((c) => {
                        const latin = `${c.genus}${c.species ? ` ${c.species}` : ""}${c.cultivar ? ` '${c.cultivar}'` : ""}`;
                        // Common name and the Latin one both: "Swiss cheese plant" alone reads like a guess.
                        const hasCommon = Boolean(c.common_name) && c.common_name!.toLowerCase() !== latin.toLowerCase();
                        return (
                          <Pressable
                            key={latin}
                            accessibilityRole="button"
                            onPress={() => useCandidate(c)}
                            style={({ pressed }) => [styles.candidate, { borderColor: t.border, backgroundColor: t.neutral.bg, opacity: pressed ? 0.75 : 1 }]}
                          >
                            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                              <Body style={{ fontWeight: "600" } as never}>{hasCommon ? c.common_name : latin}</Body>
                              {hasCommon ? <Body small muted>{latin}</Body> : null}
                            </View>
                            <Badge label={`${Math.round(c.confidence * 100)}%`} tone={c.confidence >= 0.7 ? "success" : "neutral"} />
                          </Pressable>
                        );
                      })}
                  </View>
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
                  {scanNote ? <Body small muted>{scanNote}</Body> : null}
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
            placeholder="Today if blank"
            trailing={<Button title="Pick date" small onPress={() => setPickingDate(true)} />}
            hint={dateInvalid ? "Use YYYY-MM-DD, or tap Pick date" : "Care reminders count from this date until you log something."}
            keyboardType="numbers-and-punctuation"
          />
          <Calendar
            visible={pickingDate}
            selected={acquiredIso ? new Date(acquiredIso) : null}
            onPick={setAcquiredAt}
            onClose={() => setPickingDate(false)}
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
  candidate: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md },
});
