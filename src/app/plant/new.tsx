import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SpeciesField } from "@/components/species-field";
import { CloseIcon } from "@/components/icons";
import { Badge, Body, Button, Card, Chips, Field, Heading, Row } from "@/components/ui";
import { addPhoto, createPlant, listPlants, logCare, type Plant } from "@/db";
import { findSpecies, matchCandidate, scientificName, type SpeciesEntry } from "@/domain/species";
import { scanSummary } from "@/domain/scan";
import { MAX_SCAN_PHOTOS, analyzePhoto, clearLastScan, describeCost, loadLastScan, type LastScan, type Verdict } from "@/lib/ai";
import { confirm } from "@/lib/confirm";
import { clearDraft, loadDraft, saveDraftSoon } from "@/lib/draft";
import { Calendar } from "@/components/calendar";
import { PhotoTips } from "@/components/photo-tips";
import { PlantPhoto } from "@/components/plant-photo";
import { parseDate } from "@/lib/dates";
import { capturePhoto } from "@/lib/photos";
import { supabaseConfigured } from "@/lib/supabase";
import { cardTheme, radius, space, useTheme } from "@/theme";

export default function NewPlant() {
  const t = useTheme();
  const c = cardTheme;
  const db = useSQLiteContext();
  const router = useRouter();

  // The whole plant first, then close-ups; all of them go to the AI together.
  const [photos, setPhotos] = useState<string[]>([]);
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
  // The AI candidate the keeper tapped, for the highlight and the name ideas.
  const [chosen, setChosen] = useState<Verdict["species"][number] | null>(null);
  const [restored, setRestored] = useState(false);
  // A paid scan whose screen was cleared: on offer until it's used or a new one runs.
  const [lastScan, setLastScan] = useState<LastScan | null>(null);
  // Don't overwrite a saved draft with the empty form before it's been read back.
  const hydrated = useRef(false);

  // Whatever was here last time comes back — the photo, the AI's answer, the
  // typed fields — so backing out by accident costs nothing.
  useEffect(() => {
    loadDraft().then((d) => {
      if (d) {
        setPhotos(d.photoUris);
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
    loadLastScan().then((last) => {
      // Only a scan from the add-plant flow, and only a recent one.
      if (last && last.mode === "both" && Date.now() - Date.parse(last.at) < 24 * 3600_000) setLastScan(last);
    });
  }, []);

  const bringBackLastScan = () => {
    if (!lastScan) return;
    setPhotos(lastScan.photos.slice(0, MAX_SCAN_PHOTOS));
    setVerdict(lastScan.answer.verdict);
    setScanNote("Brought back from your last scan — no charge.");
    setChosen(null);
    setRestored(false);
    setLastScan(null);
  };
  const lastScanAge = (() => {
    if (!lastScan) return "";
    const mins = Math.max(1, Math.round((Date.now() - Date.parse(lastScan.at)) / 60_000));
    return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  })();

  useEffect(() => {
    if (!hydrated.current) return;
    saveDraftSoon({
      photoUris: photos, nickname, species, pickedName: picked ? scientificName(picked) : null,
      location, acquiredFrom, acquiredAt, motherId, verdict,
    });
  }, [photos, nickname, species, picked, location, acquiredFrom, acquiredAt, motherId, verdict]);

  const startOver = async () => {
    const ok = await confirm(
      "Start over?",
      "The photos, the AI's answer and everything typed here will be cleared. A scan of the same photos is remembered, so re-adding them costs nothing.",
      { confirmText: "Start over", destructive: true },
    );
    if (!ok) return;
    await clearDraft();
    setPhotos([]); setNickname(""); setSpecies(""); setPicked(null); setLocation("");
    setAcquiredFrom(""); setAcquiredAt(""); setMotherId(""); setVerdict(null); setAiError(null); setChosen(null);
    setRestored(false);
  };

  const identify = async () => {
    if (!photos.length) return;
    setAnalyzing(true);
    setAiError(null);
    try {
      // A species already typed or picked goes along as a hint: the AI then
      // confirms or corrects it rather than guessing among look-alikes.
      const answer = await analyzePhoto(photos, { mode: "both", speciesHint: species.trim() || null });
      setVerdict(answer.verdict);
      setScanNote(describeCost(answer));
      setLastScan(null);
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
    setChosen(c);
  };

  const latinOf = (cand: Verdict["species"][number]) =>
    `${cand.genus}${cand.species ? ` ${cand.species}` : ""}${cand.cultivar ? ` '${cand.cultivar}'` : ""}`;
  const isChosen = (cand: Verdict["species"][number]) =>
    species.trim() !== "" && (species.trim().toLowerCase() === latinOf(cand).toLowerCase() || (chosen != null && latinOf(chosen) === latinOf(cand)));

  // Names worth offering once the species is known: the shop name, the
  // cultivar on its own, the Latin — so nobody has to copy and paste.
  const nameIdeas = (() => {
    const ideas: string[] = [];
    // What the AI called it comes first: "Philodendron Birkin" beats the
    // catalogue's names for the parent species.
    if (chosen) ideas.push(chosen.common_name, ...(chosen.cultivar ? [chosen.cultivar] : []));
    if (picked) ideas.push(...picked.common, ...(picked.cultivar ? [picked.cultivar] : []), scientificName(picked));
    else if (chosen) ideas.push(latinOf(chosen));
    else if (species.trim()) ideas.push(species.trim());
    const seen = new Set<string>();
    return ideas.map((n) => n.trim()).filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase())).slice(0, 4);
  })();
  const nameIdeasRow = nameIdeas.length > 0 && !nickname.trim() ? (
    <View style={{ gap: space.xs }}>
      <Body small muted>Name it — tap one, or type your own below:</Body>
      <Row>
        {nameIdeas.map((n) => (
          <Button key={n} title={n} small onPress={() => setNickname(n)} />
        ))}
      </Row>
    </View>
  ) : null;

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
      photoUri: photos[0] ?? null,
      waterEveryDays: entry?.waterEveryDays,
      fertilizeEveryDays: entry?.fertilizeEveryDays,
      repotEveryDays: entry?.repotEveryDays,
    });
    for (const uri of photos.slice(1)) await addPhoto(db, id, uri);
    // The scan's health read goes into the record, not just the species name.
    if (verdict?.is_plant) await logCare(db, id, "AI_CHECK", { notes: scanSummary(verdict) });
    await clearDraft();
    await clearLastScan();
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
        {lastScan && !verdict && photos.length === 0 ? (
          <Card>
            <Body small muted>
              {`Your last scan (${lastScanAge}, ${lastScan.photos.length} photo${lastScan.photos.length === 1 ? "" : "s"}) is still here if this screen got cleared.`}
            </Body>
            <Row>
              <Button title="Bring back the last scan" variant="primary" small onPress={bringBackLastScan} />
            </Row>
          </Card>
        ) : null}
        <Card>
          <Heading>Photo</Heading>
          {photos[0] ? (
            <PlantPhoto uri={photos[0]} mode="hero" />
          ) : (
            <View style={[styles.photo, { backgroundColor: t.forest }]} />
          )}
          {photos.length > 0 ? (
            <Row style={{ flexWrap: "nowrap" }}>
              {photos.map((uri, i) => (
                <View key={uri.slice(-40) + i} style={styles.thumbWrap}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={i === 0 ? "Main photo" : `Make photo ${i + 1} the main one`}
                    disabled={i === 0}
                    onPress={() => setPhotos((ps) => [ps[i], ...ps.filter((_, j) => j !== i)])}
                  >
                    <PlantPhoto uri={uri} mode="thumb" style={[styles.thumb, i === 0 && { borderColor: t.primary, borderWidth: 2 }]} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${i + 1}`}
                    hitSlop={8}
                    onPress={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                    style={[styles.thumbRemove, { backgroundColor: t.plum }]}
                  >
                    <CloseIcon color={t.onPlum} size={12} />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_SCAN_PHOTOS ? (
                <Body small muted style={{ flex: 1 } as never}>
                  {photos.length === 1 ? "Add a close-up or two — the scan reads them together." : `Room for ${MAX_SCAN_PHOTOS - photos.length} more. Tap a photo to make it the main one.`}
                </Body>
              ) : null}
            </Row>
          ) : null}
          <Row>
            <Button
              title={photos.length ? "Take another" : "Take photo"}
              disabled={photos.length >= MAX_SCAN_PHOTOS}
              onPress={() => capturePhoto("camera").then((u) => u && setPhotos((ps) => [...ps, u].slice(0, MAX_SCAN_PHOTOS)))}
            />
            <Button
              title={photos.length ? "Add from library" : "Choose from library"}
              disabled={photos.length >= MAX_SCAN_PHOTOS}
              onPress={() => capturePhoto("library").then((u) => u && setPhotos((ps) => [...ps, u].slice(0, MAX_SCAN_PHOTOS)))}
            />
            {photos.length > 0 && supabaseConfigured ? (
              <Button title={analyzing ? "Looking…" : "Identify with AI"} variant="primary" disabled={analyzing} onPress={identify} />
            ) : null}
          </Row>
          {aiError ? (
            <Body small style={{ color: c.critical.fg } as never}>
              {aiError}
            </Body>
          ) : null}
          {!verdict ? <PhotoTips open={photos.length === 0} /> : null}
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
                      .map((cand) => {
                        const latin = latinOf(cand);
                        // Common name and the Latin one both: "Swiss cheese plant" alone reads like a guess.
                        const hasCommon = Boolean(cand.common_name) && cand.common_name!.toLowerCase() !== latin.toLowerCase();
                        const on = isChosen(cand);
                        return (
                          <Pressable
                            key={latin}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            onPress={() => useCandidate(cand)}
                            style={({ pressed }) => [
                              styles.candidate,
                              on
                                ? { borderColor: c.gold, borderWidth: 2, backgroundColor: c.warning.bg }
                                : { borderColor: c.hairline, backgroundColor: c.input },
                              { opacity: pressed ? 0.75 : 1 },
                            ]}
                          >
                            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                              <Body style={{ fontWeight: "600" } as never}>{hasCommon ? cand.common_name : latin}</Body>
                              {hasCommon ? <Body small muted>{latin}</Body> : null}
                            </View>
                            {on ? <Badge label="Chosen" tone="success" /> : null}
                            <Badge label={`${Math.round(cand.confidence * 100)}%`} tone={cand.confidence >= 0.7 ? "success" : "neutral"} />
                          </Pressable>
                        );
                      })}
                  </View>
                  {chosen ? (
                    <Body small muted>Species set to {species}. {nickname.trim() ? "" : "Give it a name below."}</Body>
                  ) : null}
                  {nameIdeasRow}
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
          {nameIdeasRow}
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
  thumbWrap: { width: 56, height: 56 },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  thumbRemove: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
