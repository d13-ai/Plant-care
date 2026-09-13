import { Link, Stack, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { PlantCard, summarize } from "@/components/plant-card";
import { Body, Button, Card, Heading } from "@/components/ui";
import { listPlants, logCare } from "@/db";
import { useQuery } from "@/hooks/use-query";
import { space, useTheme } from "@/theme";

export default function Greenhouse() {
  const t = useTheme();
  const router = useRouter();
  const { data, refresh, db } = useQuery(listPlants);

  // Plants that want something come first — the reason to open the app.
  const items = useMemo(() => {
    if (!data) return [];
    return data
      .map((item) => ({ item, rank: summarize(item).rank }))
      .sort((a, b) => a.rank - b.rank || a.item.plant.nickname.localeCompare(b.item.plant.nickname))
      .map(({ item }) => item);
  }, [data]);

  const needsAttention = useMemo(
    () => (data ?? []).filter((item) => summarize(item).alerts.length > 0).length,
    [data],
  );

  const handleLogWater = useCallback(
    async (plantId: number) => {
      await logCare(db, plantId, "WATER");
      refresh();
    },
    [db, refresh],
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/plant/new" asChild>
              <Pressable hitSlop={12}>
                <Text style={[styles.add, { color: t.primary }]}>＋ Add</Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      {data && data.length === 0 ? (
        <View style={styles.empty}>
          <Card>
            <Heading>Start your greenhouse</Heading>
            <Body muted>
              Add a plant with a photo. Log when you water, feed or repot it, and it'll tell you
              what's due. Everything stays on this phone.
            </Body>
            <Button
              title="Add your first plant"
              variant="primary"
              onPress={() => router.push("/plant/new")}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.plant.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            data ? (
              <Body muted small style={{ paddingHorizontal: space.xs }}>
                {data.length} plant{data.length === 1 ? "" : "s"}
                {needsAttention ? ` · ${needsAttention} need attention` : " · all good"}
              </Body>
            ) : null
          }
          renderItem={({ item }) => <PlantCard item={item} onLogWater={handleLogWater} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md },
  empty: { flex: 1, justifyContent: "center", padding: space.lg },
  add: { fontSize: 16, fontWeight: "600" },
});
