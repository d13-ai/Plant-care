import { Stack, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DueRing } from "@/components/due-ring";
import { PersonIcon, PlusIcon } from "@/components/icons";
import { PlantCard, summarize } from "@/components/plant-card";
import { Body, Button, Card, Heading, Row, SectionLabel, Title } from "@/components/ui";
import { UndoBar, useUndo } from "@/components/undo-bar";
import { deleteEvent, listPlants, logCare, type PlantWithHistory } from "@/db";
import { useQuery } from "@/hooks/use-query";
import { useAccount } from "@/lib/auth";
import { okToLog } from "@/lib/care-log";
import { space, useTheme, type Tone } from "@/theme";

export default function Greenhouse() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, refresh, db } = useQuery(listPlants);
  const { account, loading: accountLoading } = useAccount();
  // Nudge until there's an account to back the greenhouse up to.
  const unbacked = !accountLoading && !(account && !account.anonymous);

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

  // The water-due strip: every plant with a watering reminder, soonest first.
  const due = useMemo(() => {
    if (!data) return [];
    return data
      .map((item) => ({ item, water: summarize(item).water }))
      .filter((d) => d.water && d.water.state !== "OFF" && d.water.everyDays)
      .sort((a, b) => (a.water!.daysUntilDue ?? 0) - (b.water!.daysUntilDue ?? 0))
      .slice(0, 8);
  }, [data]);

  const undo = useUndo();
  const handleLogWater = useCallback(
    async (plantId: number) => {
      const item = data?.find((i) => i.plant.id === plantId);
      if (!(await okToLog("WATER", item?.events ?? []))) return;
      const eventId = await logCare(db, plantId, "WATER");
      refresh();
      undo.show({
        message: `Watered ${item?.plant.nickname ?? "plant"}`,
        undo: async () => {
          await deleteEvent(db, eventId);
          refresh();
        },
      });
    },
    [db, refresh, data, undo],
  );

  const ringFor = (item: PlantWithHistory, water: NonNullable<ReturnType<typeof summarize>["water"]>) => {
    const every = water.everyDays ?? 1;
    const untilDue = water.daysUntilDue ?? every;
    // A water tank: full ring right after watering, draining toward empty as
    // the next watering approaches. Overdue shows a full red ring.
    const remaining = Math.max(0, Math.min(1, untilDue / every));
    const tone: Tone = water.state === "OVERDUE" ? "critical" : water.state === "DUE_SOON" ? "warning" : "success";
    const fill = water.state === "OVERDUE" ? 1 : Math.max(remaining, 0.06);
    const label = untilDue <= 0 ? "Now" : untilDue === 1 ? "1 day" : `${untilDue} days`;
    return (
      <DueRing
        key={item.plant.id}
        uri={item.photos[0]?.uri ?? null}
        progress={fill}
        color={t[tone].ring}
        label={label}
        onPress={() => router.push({ pathname: "/plant/[id]", params: { id: String(item.plant.id) } })}
      />
    );
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Title>Greenhouse</Title>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Account"
            hitSlop={8}
            onPress={() => router.push("/account")}
            style={({ pressed }) => [styles.add, { backgroundColor: t.neutral.bg, opacity: pressed ? 0.75 : 1 }]}
          >
            <PersonIcon color={t.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="Add plant"
            hitSlop={8}
            onPress={() => router.push("/plant/new")}
            style={({ pressed }) => [styles.add, { backgroundColor: t.primary, opacity: pressed ? 0.75 : 1 }]}
          >
            <PlusIcon color={t.onPrimary} />
          </Pressable>
        </View>
      </View>

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
              <View style={styles.listHeader}>
                {unbacked && (
                  <Card>
                    <Heading>Your plants live only on this phone</Heading>
                    <Body small muted>
                      Add your email to back them up and see them on any phone you sign into.
                    </Body>
                    <Row>
                      <Button title="Sign in" variant="primary" small onPress={() => router.push("/account")} />
                    </Row>
                  </Card>
                )}
                {due.length > 0 && (
                  <View style={{ gap: space.sm }}>
                    <SectionLabel>Water due</SectionLabel>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                      {due.map((d) => ringFor(d.item, d.water!))}
                    </ScrollView>
                  </View>
                )}
                <View style={styles.listTitle}>
                  <SectionLabel>All plants</SectionLabel>
                  <Body small muted>
                    {needsAttention ? `${needsAttention} need${needsAttention === 1 ? "s" : ""} attention` : `${data.length} plant${data.length === 1 ? "" : "s"} · all good`}
                  </Body>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => <PlantCard item={item} onLogWater={handleLogWater} />}
        />
      )}
      <UndoBar offer={undo.offer} dismiss={undo.dismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 8,
  },
  headerActions: { flexDirection: "row", gap: space.sm },
  add: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: 10 },
  listHeader: { gap: space.md, paddingTop: 6, paddingBottom: 4 },
  strip: { gap: 14, paddingHorizontal: 4, paddingVertical: 2 },
  listTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  empty: { flex: 1, justifyContent: "center", padding: space.lg },
});
