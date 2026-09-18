import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { CloseIcon } from "@/components/icons";
import { Badge, Body, Button, Card, Chips, Field, Heading, Row } from "@/components/ui";
import { UndoBar, useUndo } from "@/components/undo-bar";
import { addPhoto, coverPhoto, deleteEvent, deletePlant, getPlant, logCare, propagate, resolveIssue, setCoverPhoto, type CareEvent } from "@/db";
import {
  CARE_EVENT_LABELS,
  LOGGABLE_CARE_TYPES,
  REPEAT_PROMPT,
  careStatuses,
  formatDate,
  openIssues,
  plantAlerts,
  relativeDays,
  type CareType,
  type DueState,
} from "@/domain/care";
import { useQuery } from "@/hooks/use-query";
import { daysAgoIso } from "@/lib/dates";
import { getKeeperName, publishTag, setKeeperName, unpublishTag } from "@/lib/tag";
import { scanSummary } from "@/domain/scan";
import { MAX_SCAN_PHOTOS, analyzePhoto, describeScan, photoAllowance, type Verdict } from "@/lib/ai";
import { allowanceLine, type Allowance } from "@/domain/allowance";
import { CareGuide } from "@/components/care-guide";
import { PhotoTips } from "@/components/photo-tips";
import { PlantPhoto } from "@/components/plant-photo";
import { getCareCard } from "@/lib/care-card";
import { buildPlantIcs, saveIcs, slugify, tasksFromStatuses } from "@/lib/calendar";
import { okToLog } from "@/lib/care-log";
import { confirm } from "@/lib/confirm";
import { capturePhoto } from "@/lib/photos";
import { tagUrl, supabaseConfigured } from "@/lib/supabase";
import { cardTheme, font, radius, space, useTheme, type Tone } from "@/theme";

const toneFor: Record<DueState, Tone> = {
  OVERDUE: "critical",
  DUE_SOON: "warning",
  OK: "success",
  OFF: "neutral",
};

export default function PlantDetail() {
  const t = useTheme();
  const c = cardTheme;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plantId = Number(id);
  const { data, refresh, db } = useQuery((d) => getPlant(d, plantId), [plantId]);

  const [logType, setLogType] = useState<CareType>("WATER");
  const [logNotes, setLogNotes] = useState("");
  const [logDaysAgo, setLogDaysAgo] = useState("");
  const [cuttingName, setCuttingName] = useState("");
  const [keeperName, setKeeperNameState] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkup, setCheckup] = useState<Verdict | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkNote, setCheckNote] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [calBusy, setCalBusy] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);

  useEffect(() => {
    getKeeperName().then(setKeeperNameState);
    // Before the health check runs, not after it: see src/domain/allowance.ts.
    photoAllowance().then(setAllowance);
  }, []);

  const undo = useUndo();
  // What just went into the record, with a way back for a slip of the thumb.
  const offerUndo = useCallback(
    (type: CareType, eventId: number) => {
      const words = REPEAT_PROMPT[type];
      const did = words ? words.past.charAt(0).toUpperCase() + words.past.slice(1) : `Logged: ${CARE_EVENT_LABELS[type]}`;
      undo.show({
        message: `${did} ${data?.plant.nickname ?? ""}`.trim(),
        undo: async () => {
          await deleteEvent(db, eventId);
          refresh();
        },
      });
    },
    [db, refresh, data, undo],
  );

  const quickLog = useCallback(
    async (type: CareType) => {
      if (!(await okToLog(type, data?.events ?? []))) return;
      const eventId = await logCare(db, plantId, type);
      refresh();
      offerUndo(type, eventId);
    },
    [db, plantId, refresh, data, offerUndo],
  );

  const removeEvent = useCallback(
    async (event: CareEvent) => {
      const ok = await confirm(
        `Remove "${CARE_EVENT_LABELS[event.type] ?? event.type}" from ${formatDate(event.occurredAt)}?`,
        "It comes out of this plant's record and reminders count from the entry before it.",
        { confirmText: "Remove", destructive: true },
      );
      if (!ok) return;
      await deleteEvent(db, event.id);
      refresh();
    },
    [db, refresh],
  );

  if (!data) return <View style={{ flex: 1 }} />;

  const { plant, events, photos, mother, propagations } = data;
  const statuses = careStatuses(plant, events);
  const issues = openIssues(events);
  const alerts = plantAlerts(statuses, issues.length);
  const hero = coverPhoto(plant, photos);

  const submitLog = async () => {
    const occurredAt = daysAgoIso(logDaysAgo);
    if (!(await okToLog(logType, events, occurredAt))) return;
    const eventId = await logCare(db, plantId, logType, { notes: logNotes, occurredAt });
    setLogNotes("");
    setLogDaysAgo("");
    refresh();
    offerUndo(logType, eventId);
  };

  const addToCalendar = async () => {
    setCalBusy(true);
    setCalError(null);
    try {
      // Pull the (cached) care guide so the reminders carry real instructions;
      // never let a missing guide stop the schedule from exporting.
      let care = null;
      if (plant.species?.trim() && supabaseConfigured) {
        try {
          care = await getCareCard(db, plant.species);
        } catch {
          care = null;
        }
      }
      const tasks = tasksFromStatuses(statuses, care);
      if (tasks.length === 0) {
        setCalError("No watering or feeding schedule set yet — add one in Edit first.");
        return;
      }
      const ics = buildPlantIcs({
        nickname: plant.nickname,
        species: plant.species,
        token: plant.passportToken,
        tagUrl: plant.passportToken ? tagUrl(plant.passportToken) : null,
        tasks,
      });
      await saveIcs(`${slugify(plant.nickname)}-care.ics`, ics);
    } catch (err) {
      setCalError(err instanceof Error ? err.message : String(err));
    } finally {
      setCalBusy(false);
    }
  };

  const takePhoto = async (source: "camera" | "library") => {
    const uri = await capturePhoto(source);
    if (!uri) return;
    await addPhoto(db, plantId, uri);
    refresh();
  };

  const makeCutting = async () => {
    if (!cuttingName.trim()) return;
    const childId = await propagate(db, plantId, cuttingName);
    setCuttingName("");
    router.push({ pathname: "/plant/[id]", params: { id: String(childId) } });
  };

  // The share sheet is a convenience on top of the link already on screen:
  // on web without navigator.share it rejects, and a dismissed sheet can too.
  // Neither is an error worth showing, least of all after a publish succeeded.
  const shareLink = (url: string) =>
    Share.share({ message: `${plant.nickname}'s plant tag: ${url}`, url }).catch(() => {});

  // The newest photos go together, newest first — a close-up taken just now
  // rides along with the last full view.
  const checkHealth = async (uris: string[], speciesHint: string | null) => {
    setChecking(true);
    setCheckError(null);
    try {
      const answer = await analyzePhoto(uris, { mode: "health", speciesHint });
      setCheckup(answer.verdict);
      setCheckNote(describeScan(answer));
      setAllowance(await photoAllowance());
      // A fresh read goes into the history; a remembered one is already there.
      if (!answer.cached && answer.verdict.is_plant) {
        await logCare(db, plantId, "AI_CHECK", { notes: scanSummary(answer.verdict) });
        refresh();
      }
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      await setKeeperName(keeperName);
      const url = await publishTag(db, plantId);
      refresh();
      await shareLink(url);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      await unpublishTag(db, plantId);
      refresh();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  };

  const confirmDelete = async () => {
    const ok = await confirm(
      `Remove ${plant.nickname}?`,
      "Its whole history and photos go with it. Mark it Deceased instead if you want to keep the record.",
      { confirmText: "Remove", destructive: true },
    );
    if (!ok) return;
    // A published plant's tag would otherwise stay live with no record left
    // to take it down from.
    if (plant.passportToken) {
      try {
        await unpublishTag(db, plantId);
      } catch (err) {
        setPublishError(
          `Couldn't take the tag down, so the plant was kept: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }
    }
    await deletePlant(db, plantId);
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: plant.nickname,
          headerRight: () => (
            <Pressable
              hitSlop={12}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/plant/[id]/edit", params: { id: String(plantId) } })}
              // The header's right slot is flush with the screen edge on the
              // web, so the button carries its own inset.
              style={{ paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <Text style={{ color: t.primary, fontSize: 16, fontWeight: "700", fontFamily: font.bold }}>Edit</Text>
            </Pressable>
          ),
        }}
      />

      {hero ? (
        <PlantPhoto uri={hero.uri} mode="hero" />
      ) : null}

      <Row>
        {plant.status !== "ACTIVE" && <Badge label={plant.status.toLowerCase()} />}
        {alerts.length === 0 ? (
          <Badge label="All good" tone="success" />
        ) : (
          alerts.map((a) => <Badge key={a.label} label={a.label} tone={a.tone} />)
        )}
      </Row>
      <Body muted small>
        {[plant.species, plant.location].filter(Boolean).join(" · ") || "Species not set"}
        {" · since "}
        {formatDate(plant.acquiredAt)}
        {plant.acquiredFrom ? ` · from ${plant.acquiredFrom}` : ""}
      </Body>

      {issues.length > 0 && (
        <Card style={{ backgroundColor: c.critical.bg, borderColor: c.critical.ring }}>
          <Heading>Special care needed</Heading>
          {issues.map((issue) => (
            <View key={issue.id} style={{ gap: space.sm }}>
              <Body>
                {issue.notes || "Issue reported"} · {formatDate(issue.occurredAt)}
              </Body>
              <Row>
                <Button
                  title="Mark resolved"
                  small
                  onPress={async () => {
                    await resolveIssue(db, issue.id);
                    refresh();
                  }}
                />
              </Row>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Heading>Tag</Heading>
        {plant.passportToken ? (
          <>
            <Body small muted>
              Published {formatDate(plant.publishedAt)}. Anyone with the link sees this plant's
              lineage, keepers, care record and photos — nothing else of yours.
            </Body>
            <Body small style={{ color: c.goldText } as never}>
              {tagUrl(plant.passportToken)}
            </Body>
          </>
        ) : (
          <Body small muted>
            Publish a shareable record of this plant — its lineage, care history, issues and what
            fixed them — to send with a sale or trade.
          </Body>
        )}
        <Field
          label="Shown on tags as"
          value={keeperName}
          onChangeText={setKeeperNameState}
          placeholder="Dana's greenhouse"
        />
        {publishError ? (
          <Body small style={{ color: c.critical.fg } as never}>
            {publishError}
          </Body>
        ) : null}
        <Row>
          <Button
            title={publishing ? "Working…" : plant.passportToken ? "Update & share" : "Publish tag"}
            variant="primary"
            small
            disabled={publishing || !supabaseConfigured}
            onPress={publish}
          />
          {plant.passportToken ? (
            <>
              <Button
                title="Share link"
                small
                disabled={publishing}
                onPress={() => shareLink(tagUrl(plant.passportToken!))}
              />
              <Button title="Unpublish" small disabled={publishing} onPress={unpublish} />
            </>
          ) : null}
        </Row>
      </Card>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Heading>Care schedule</Heading>
          <Button
            title={calBusy ? "Preparing…" : "Add to calendar"}
            variant="gold"
            small
            disabled={calBusy}
            onPress={addToCalendar}
          />
        </Row>
        {calError ? (
          <Body small style={{ color: c.critical.fg } as never}>
            {calError}
          </Body>
        ) : null}
        {statuses.map((care) => (
          <View key={care.type} style={[styles.careRow, { borderTopColor: t.hairline }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Row>
                <Body style={{ fontWeight: "600" } as never}>{care.label}</Body>
                <Badge
                  tone={toneFor[care.state]}
                  label={
                    care.state === "OFF"
                      ? "Off"
                      : care.state === "OVERDUE"
                        ? care.dueLabel
                        : care.state === "DUE_SOON"
                          ? `Due in ${care.daysUntilDue}d`
                          : `Due ${formatDate(care.dueAt)}`
                  }
                />
              </Row>
              <Body small muted>
                {care.daysSinceLast === null ? "Never logged" : `Last ${relativeDays(care.daysSinceLast)}`}
                {care.everyDays ? ` · every ${care.everyDays} days` : ""}
              </Body>
            </View>
            <Button title="Log" variant="plum" small onPress={() => quickLog(care.type)} />
          </View>
        ))}
      </Card>

      <CareGuide species={plant.species} />

      <Card>
        <Heading>Log care</Heading>
        <Chips
          options={LOGGABLE_CARE_TYPES.map((type) => ({ label: CARE_EVENT_LABELS[type], value: type }))}
          value={logType}
          onChange={setLogType}
        />
        <Field
          label="Notes"
          value={logNotes}
          onChangeText={setLogNotes}
          placeholder={logType === "ISSUE" ? "Spider mites on new growth" : "Optional"}
        />
        <Field
          label="Days ago"
          value={logDaysAgo}
          onChangeText={setLogDaysAgo}
          placeholder="0"
          keyboardType="number-pad"
          hint="Leave blank for now."
        />
        <Button title="Add to history" variant="primary" onPress={submitLog} />
      </Card>

      <Card>
        <Heading>Photos</Heading>
        {photos.length === 0 ? (
          <Body muted small>
            No photos yet. One every few months is what makes the health record worth anything.
          </Body>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Row style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              {photos.map((photo) => {
                const main = hero?.id === photo.id;
                return (
                  <Pressable
                    key={photo.id}
                    accessibilityRole="button"
                    accessibilityLabel={main ? `Main photo, ${formatDate(photo.takenAt)}` : `Make the photo from ${formatDate(photo.takenAt)} the main one`}
                    disabled={main}
                    onPress={async () => {
                      await setCoverPhoto(db, plantId, photo.id);
                      refresh();
                    }}
                    style={({ pressed }) => ({ gap: 4, opacity: pressed ? 0.7 : 1 })}
                  >
                    <PlantPhoto uri={photo.uri} mode="thumb" style={[styles.photo, main && { borderWidth: 3, borderColor: c.gold }]} />
                    <Row>
                      <Body small muted>{formatDate(photo.takenAt)}</Body>
                      {main ? <Badge label="Main" tone="warning" /> : null}
                    </Row>
                  </Pressable>
                );
              })}
            </Row>
          </ScrollView>
        )}
        <Row>
          <Button title="Take photo" small onPress={() => takePhoto("camera")} />
          <Button title="Choose" small onPress={() => takePhoto("library")} />
        </Row>
        {photos.length > 1 ? (
          <Body small muted>Tap a photo to make it the main one. Changing it doesn't touch the AI checks on record.</Body>
        ) : null}
        <Row>
          {hero && supabaseConfigured ? (
            <Button
              title={checking ? "Looking…" : "Check health with AI"}
              small
              variant="primary"
              disabled={checking}
              onPress={() => checkHealth(photos.slice(0, MAX_SCAN_PHOTOS).map((ph) => ph.uri), plant.species)}
            />
          ) : null}
        </Row>
        <PhotoTips />
        {checkError ? (
          <Body small style={{ color: c.critical.fg } as never}>
            {checkError}
          </Body>
        ) : null}
        {checkup ? (
          <View style={{ gap: space.sm }}>
            <Row>
              <Badge
                label={`Health: ${checkup.health.overall}`}
                tone={checkup.health.overall === "healthy" ? "success" : checkup.health.overall === "unwell" ? "critical" : checkup.health.overall === "watch" ? "warning" : "neutral"}
              />
              {checkup.species[0] ? <Badge label={`Looks like ${checkup.species[0].common_name || checkup.species[0].genus}`} /> : null}
            </Row>
            {checkup.health.findings.length === 0 ? (
              <Body small muted>Nothing worrying in this photo.</Body>
            ) : (
              checkup.health.findings.map((f) => (
                <View key={f.observation} style={{ gap: 4 }}>
                  <Body small>
                    {f.observation} — likely {f.likely_cause.toLowerCase()}. {f.suggested_action}
                  </Body>
                  <Row>
                    <Button
                      title="Log as issue"
                      small
                      onPress={async () => {
                        await logCare(db, plantId, "ISSUE", { notes: `${f.observation} — ${f.suggested_action}` });
                        refresh();
                      }}
                    />
                  </Row>
                </View>
              ))
            )}
            {checkup.notes ? <Body small muted>{checkup.notes}</Body> : null}
            {checkNote ? <Body small muted>{checkNote}</Body> : null}
            {!checkNote && allowance && allowanceLine(allowance) ? (
              <Body small muted>{allowanceLine(allowance)}</Body>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card>
        <Heading>Lineage</Heading>
        {mother ? (
          <Pressable onPress={() => router.push({ pathname: "/plant/[id]", params: { id: String(mother.id) } })}>
            <Body>
              Cutting from <Text style={{ color: c.goldText, fontWeight: "600" }}>{mother.nickname}</Text>
              {plant.propagatedAt ? ` · ${formatDate(plant.propagatedAt)}` : ""}
            </Body>
          </Pressable>
        ) : (
          <Body muted small>
            No mother plant recorded — this one starts the line.
          </Body>
        )}
        {propagations.length > 0 && (
          <View style={{ gap: space.xs }}>
            <Body small style={{ fontWeight: "600" } as never}>
              Cuttings taken
            </Body>
            {propagations.map((child) => (
              <Pressable
                key={child.id}
                onPress={() => router.push({ pathname: "/plant/[id]", params: { id: String(child.id) } })}
              >
                <Body small>
                  <Text style={{ color: c.goldText, fontWeight: "600" }}>{child.nickname}</Text>
                  {" · "}
                  {formatDate(child.propagatedAt)}
                </Body>
              </Pressable>
            ))}
          </View>
        )}
        <Field
          label="Log a propagation"
          value={cuttingName}
          onChangeText={setCuttingName}
          placeholder={`${plant.nickname} cutting`}
          hint="Creates a new plant whose record traces back to this one."
        />
        <Row>
          <Button title="Create cutting" small disabled={!cuttingName.trim()} onPress={makeCutting} />
        </Row>
      </Card>

      {plant.notes ? (
        <Card>
          <Heading>Notes</Heading>
          <Body>{plant.notes}</Body>
        </Card>
      ) : null}

      <Card>
        <Heading>History</Heading>
        {events.map((event) => (
          <View key={event.id} style={styles.event}>
            <Body small muted style={{ width: 92 } as never}>
              {formatDate(event.occurredAt)}
            </Body>
            <View style={{ flex: 1 }}>
              <Body>
                {CARE_EVENT_LABELS[event.type] ?? event.type}
                {event.type === "ISSUE" && event.resolvedAt
                  ? ` · resolved ${formatDate(event.resolvedAt)}`
                  : ""}
              </Body>
              {event.notes ? (
                <Body small muted>
                  {event.notes}
                </Body>
              ) : null}
            </View>
            {event.type !== "ACQUIRED" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${CARE_EVENT_LABELS[event.type] ?? event.type} from ${formatDate(event.occurredAt)}`}
                hitSlop={10}
                onPress={() => removeEvent(event)}
                style={({ pressed }) => [styles.remove, { backgroundColor: c.neutral.bg, opacity: pressed ? 0.6 : 1 }]}
              >
                <CloseIcon color={c.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Body small muted>Logged something by mistake? Tap × to take it out of the record.</Body>
      </Card>

      <Button title="Remove plant" variant="danger" onPress={confirmDelete} />
    </ScrollView>
    <UndoBar offer={undo.offer} dismiss={undo.dismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  photo: { width: 120, height: 120, borderRadius: radius.md },
  careRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  event: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  remove: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
