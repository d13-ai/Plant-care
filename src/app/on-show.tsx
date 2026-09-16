import { Stack, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { PlantPhoto } from "@/components/plant-photo";
import { Body, Button, Card, Row, Title } from "@/components/ui";
import { coverPhoto, listPlants } from "@/db";
import { useQuery } from "@/hooks/use-query";
import { getHandle, parlourUrl } from "@/lib/parlour";
import { publishTag, unpublishTag } from "@/lib/tag";
import { font, radius, space, useTheme } from "@/theme";
import { useEffect } from "react";

/**
 * What's on show: the whole greenhouse with a switch per plant, deciding which
 * ones appear in the keeper's parlour.
 *
 * Publishing already existed, one plant at a time on that plant's own page —
 * which is fine for sending someone a single tag and hopeless for curating a
 * collection. Putting five plants on show meant opening five plants. This is
 * the same two calls (`publishTag` / `unpublishTag`) over the whole list.
 */
export default function OnShow() {
  const t = useTheme();
  const router = useRouter();
  const { data, refresh, db } = useQuery(listPlants);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    getHandle().then(setHandle).catch(() => {});
  }, []);

  const toggle = useCallback(
    async (plantId: number, on: boolean) => {
      setBusy(plantId);
      setError(null);
      try {
        await (on ? publishTag(db, plantId) : unpublishTag(db, plantId));
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [db, refresh],
  );

  const plants = data ?? [];
  const onShow = plants.filter((p) => p.plant.publishedAt).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "What's on show" }} />

      <Card>
        <Title>What's on show</Title>
        <Body small muted>
          {onShow === 0
            ? "Nothing is on show yet. Anything you switch on appears in your parlour, and gets its own link to send someone."
            : `${onShow} of ${plants.length} ${plants.length === 1 ? "plant" : "plants"} in your parlour. Everything else stays private.`}
        </Body>
        {handle ? <Body small muted>{parlourUrl(handle)}</Body> : null}
        {error ? <Body small style={{ color: t.critical.fg }}>{error}</Body> : null}
      </Card>

      {plants.length === 0 ? (
        <Body muted>No plants yet. Add one and it can go on show.</Body>
      ) : (
        <View style={styles.list}>
          {plants.map(({ plant, photos }) => {
            const photo = coverPhoto(plant, photos);
            const on = Boolean(plant.publishedAt);
            return (
              <View key={plant.id} style={[styles.row, { borderColor: t.hairline }]}>
                {photo ? (
                  <PlantPhoto uri={photo.uri} mode="thumb" style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.noshot, { borderColor: t.hairline }]} />
                )}
                <View style={styles.rowText}>
                  <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{plant.nickname}</Text>
                  {plant.species ? (
                    <Body small muted style={styles.species}>{plant.species}</Body>
                  ) : null}
                </View>
                <Switch
                  value={on}
                  disabled={busy === plant.id}
                  onValueChange={(next) => toggle(plant.id, next)}
                  trackColor={{ true: t.gold, false: t.hairline }}
                  accessibilityLabel={`${on ? "Take" : "Put"} ${plant.nickname} ${on ? "off" : "on"} show`}
                />
              </View>
            );
          })}
        </View>
      )}

      <Row>
        <Button
          title="Done"
          variant="primary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
      </Row>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  list: { gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 52, height: 52, borderRadius: radius.md },
  noshot: { borderWidth: 1, opacity: 0.5 },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: font.serif, fontSize: 17 },
  species: { fontStyle: "italic" },
});
