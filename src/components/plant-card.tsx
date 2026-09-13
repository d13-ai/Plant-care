import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Badge, Body, Button, Card, Heading, Row } from "@/components/ui";
import type { PlantWithHistory } from "@/db";
import { careStatuses, openIssues, plantAlerts, relativeDays } from "@/domain/care";
import { radius, space, useTheme } from "@/theme";

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
  return { statuses, issues, alerts, rank, lastWatered: water?.daysSinceLast ?? null };
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
  const { alerts, lastWatered } = summarize(item);
  const photo = photos[0];

  return (
    <Link href={{ pathname: "/plant/[id]", params: { id: String(plant.id) } }} asChild>
      <Pressable>
        <Card>
          <View style={styles.top}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: t.neutral.bg }]} />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Heading>{plant.nickname}</Heading>
              <Body small muted>
                {plant.species || "Species not set"}
                {plant.location ? ` · ${plant.location}` : ""}
              </Body>
              <Body small muted>
                {lastWatered === null ? "Never watered" : `Watered ${relativeDays(lastWatered)}`}
              </Body>
            </View>
          </View>

          <Row>
            {plant.status !== "ACTIVE" && <Badge label={plant.status.toLowerCase()} />}
            {alerts.length === 0 ? (
              <Badge label="All good" tone="success" />
            ) : (
              alerts.map((alert) => <Badge key={alert.label} label={alert.label} tone={alert.tone} />)
            )}
          </Row>

          <Row>
            <Button title="Log water" small onPress={() => onLogWater(plant.id)} />
          </Row>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
});
