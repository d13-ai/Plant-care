import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Badge, Body, Button, Card, Chips, Field, Heading, Row } from "@/components/ui";
import { addPhoto, deletePlant, getPlant, logCare, propagate, resolveIssue } from "@/db";
import {
  CARE_EVENT_LABELS,
  LOGGABLE_CARE_TYPES,
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
import { capturePhoto } from "@/lib/photos";
import { tagUrl, supabaseConfigured } from "@/lib/supabase";
import { radius, space, useTheme, type Tone } from "@/theme";

const toneFor: Record<DueState, Tone> = {
  OVERDUE: "critical",
  DUE_SOON: "warning",
  OK: "success",
  OFF: "neutral",
};

export default function PlantDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plantId = Number(id);
  const { data, refresh, db } = useQuery((d) => getPlant(d, plantId), [plantId]);

  const [logType, setLogType] = useState<CareType>("WATER");
  const [logNotes, setLogNotes] = useState("");
  const [logDaysAgo, setLogDaysAgo] = useState("");
  const [cuttingName, setCuttingName] = useState("");
  const [keeperName, setKeeperNameState] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    getKeeperName().then(setKeeperNameState);
  }, []);

  const quickLog = useCallback(
    async (type: CareType) => {
      await logCare(db, plantId, type);
      refresh();
    },
    [db, plantId, refresh],
  );

  if (!data) return <View style={{ flex: 1 }} />;

  const { plant, events, photos, mother, propagations } = data;
  const statuses = careStatuses(plant, events);
  const issues = openIssues(events);
  const alerts = plantAlerts(statuses, issues.length);
  const hero = photos[0];

  const submitLog = async () => {
    await logCare(db, plantId, logType, { notes: logNotes, occurredAt: daysAgoIso(logDaysAgo) });
    setLogNotes("");
    setLogDaysAgo("");
    refresh();
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

  const confirmDelete = () =>
    Alert.alert(
      `Remove ${plant.nickname}?`,
      "Its whole history and photos go with it. Mark it Deceased instead if you want to keep the record.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            // A published plant's tag would otherwise stay live with no
            // record left to take it down from.
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
          },
        },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: plant.nickname,
          headerRight: () => (
            <Pressable
              hitSlop={12}
              onPress={() => router.push({ pathname: "/plant/[id]/edit", params: { id: String(plantId) } })}
            >
              <Text style={{ color: t.primary, fontSize: 16, fontWeight: "600" }}>Edit</Text>
            </Pressable>
          ),
        }}
      />

      {hero ? (
        <Image source={{ uri: hero.uri }} style={styles.hero} contentFit="cover" />
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
        <Card style={{ backgroundColor: t.critical.bg, borderColor: t.critical.bg }}>
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
            <Body small style={{ color: t.primary } as never}>
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
          <Body small style={{ color: t.critical.fg } as never}>
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
        <Heading>Care schedule</Heading>
        {statuses.map((care) => (
          <View key={care.type} style={[styles.careRow, { borderTopColor: t.border }]}>
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
            <Button title="Log" small onPress={() => quickLog(care.type)} />
          </View>
        ))}
      </Card>

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
            <Row style={{ flexWrap: "nowrap" }}>
              {photos.map((photo) => (
                <View key={photo.id} style={{ gap: 4 }}>
                  <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
                  <Body small muted>
                    {formatDate(photo.takenAt)}
                  </Body>
                </View>
              ))}
            </Row>
          </ScrollView>
        )}
        <Row>
          <Button title="Take photo" small onPress={() => takePhoto("camera")} />
          <Button title="Choose" small onPress={() => takePhoto("library")} />
        </Row>
      </Card>

      <Card>
        <Heading>Lineage</Heading>
        {mother ? (
          <Pressable onPress={() => router.push({ pathname: "/plant/[id]", params: { id: String(mother.id) } })}>
            <Body>
              Cutting from <Text style={{ color: t.primary, fontWeight: "600" }}>{mother.nickname}</Text>
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
                  <Text style={{ color: t.primary, fontWeight: "600" }}>{child.nickname}</Text>
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
          </View>
        ))}
      </Card>

      <Button title="Remove plant" variant="danger" onPress={confirmDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  hero: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg },
  photo: { width: 120, height: 120, borderRadius: radius.md },
  careRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  event: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
});
