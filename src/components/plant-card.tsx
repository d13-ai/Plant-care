import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { DropIcon, TagIcon } from "@/components/icons";
import { Badge, Body, Card, Heading, IconButton } from "@/components/ui";
import type { PlantWithHistory } from "@/db";
import { careStatuses, openIssues, plantAlerts, relativeDays } from "@/domain/care";
import { space, useTheme } from "@/theme";

export function summarize({ plant, events }: PlantWithHistory) {
  const statuses = careStatuses(plant, events);
  const issues = openIssues(events);
  const alerts = plantAlerts(statuses, issues.length);
  const water = statuses.find((s) => s.type === "WATER");
  // 0 = critical, 1 = overdue, 2 = due soon, 3 = fine — used to sort the list.
  const rank = alerts.some((a) => a.tone === "critical")
    ? 0
    : alerts.some((a) => a.tone === "warning")
      ? 1
      : alerts.length > 0
        ? 2
        : 3;
  return { statuses, issues, alerts, rank, water, lastWatered: water?.daysSinceLast ?? null };
}

export function PlantCard({
  item,
  onLogWater,
}: {
  item: PlantWithHistory;
  onLogWater: (plantId: number) => void;
}) {
  const t = useTheme();
  const { plant, photos } = item;
  const { alerts, water, lastWatered } = summarize(item);
  const photo = photos[0];
  const waterNow = water?.state === "OVERDUE";

  return (
    <Card contentStyle={styles.card}>
      {/* The link stops before the drop: on the web a tap inside an anchor
          follows it, and logging water must not leave the greenhouse. */}
      <Link href={{ pathname: "/plant/[id]", params: { id: String(plant.id) } }} asChild>
        {/* A plain style object: Link merges its own style with the child's into
            an array, and a style *function* inside that array is dropped on the
            web — the row collapsed into a column and the drop slid off screen. */}
        <Pressable style={styles.body}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, { backgroundColor: t.forest }]} />
          )}

          <View style={styles.middle}>
            <Heading>{plant.nickname}</Heading>
            <Body small muted>
              {plant.species || "Species not set"}
              {plant.location ? ` · ${plant.location}` : ""}
              {" · "}
              {lastWatered === null ? "never watered" : `watered ${relativeDays(lastWatered)}`}
            </Body>
            <View style={styles.badges}>
              {plant.status !== "ACTIVE" && <Badge label={plant.status.toLowerCase()} />}
              {alerts.length === 0 ? (
                <Badge label="All good" tone="success" />
              ) : (
                alerts.map((alert) => <Badge key={alert.label} label={alert.label} tone={alert.tone} />)
              )}
              {plant.passportToken ? (
                <Badge label="Tagged" tone="success" icon={<TagIcon color={t.success.fg} />} />
              ) : null}
            </View>
          </View>
        </Pressable>
      </Link>

      <IconButton label={`Log water for ${plant.nickname}`} filled={waterNow} onPress={() => onLogWater(plant.id)}>
        <DropIcon color={waterNow ? t.dropFilled : t.drop} strokeWidth={waterNow ? 2.2 : 2} />
      </IconButton>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: space.md, padding: 9 },
  body: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, minWidth: 0 },
  thumb: { width: 64, height: 64, borderRadius: 14 },
  middle: { flex: 1, gap: 4, minWidth: 0 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
});
