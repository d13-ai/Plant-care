import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { DropIcon, LogoMark } from "@/components/icons";
import { Badge, Body, Button, Card, Heading, SectionLabel, Title } from "@/components/ui";
import { radius, space, useTheme } from "@/theme";

/**
 * What a new keeper sees before their first plant.
 *
 * It used to be one card -- "Your parlour's empty", a paragraph and a button
 * -- and both of the first two people to sign up (2 and 3 Oct 2026) stopped
 * there: an account each, no plant, no photo, never back. Nothing on it said
 * what adding a plant would get them, and "add a plant" sounds like typing
 * into a form.
 *
 * So it leads with the one step, phrased as the thing to do with a phone in
 * hand, and then shows what that step gives back: an example read, labelled
 * as one, in the same pieces the app really returns -- a name to the
 * cultivar, a health read with what to do, the watering rhythm, whether it's
 * safe for pets. It is static on purpose: an example costs nothing to show,
 * and a live scan before anyone asks would spend their allowance.
 *
 * The example is a Marble Queen pothos because almost everybody has a pothos,
 * and every line on it is true of one: the catalogue's 8-day watering and
 * 30-day feed, and the ASPCA's listing of pothos as toxic to cats and dogs.
 */
export function FirstPlant() {
  const t = useTheme();
  const router = useRouter();
  const add = () => router.push("/plant/new");

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card>
        <Title>Start with one plant</Title>
        <Body>
          Photograph any plant you have — the whole plant, then a close-up. You'll get back what it is, how
          it's doing, and when it wants water.
        </Body>
        <Button title="Photograph a plant" variant="primary" onPress={add} />
      </Card>

      <View style={styles.exampleLabel}>
        <SectionLabel>What one photo gets you</SectionLabel>
        <Body small muted>Example</Body>
      </View>
      <Card>
        <View style={styles.exampleHead}>
          <View style={[styles.thumb, { backgroundColor: t.forest }]}>
            <LogoMark size={34} />
          </View>
          <View style={styles.headText}>
            <Heading>Marble Queen pothos</Heading>
            <Body small muted>Epipremnum aureum 'Marble Queen'</Body>
          </View>
          <Badge label="92% sure" tone="success" />
        </View>

        <ExampleLine label="Health">
          <View style={styles.badges}>
            <Badge label="Worth watching" tone="attention" />
          </View>
          <Body small>
            One lower leaf is turning yellow — most likely an old leaf ageing out. Pull it off once it's fully
            yellow.
          </Body>
        </ExampleLine>

        <ExampleLine label="Care">
          <View style={styles.careRow}>
            <DropIcon size={16} color={t.gold} />
            <Body small>Water about every 8 days, feed monthly.</Body>
          </View>
          <Body small muted>
            Tap the drop when you water and it counts down from there. Soil still wet? Press Still moist and it
            waits.
          </Body>
        </ExampleLine>

        <ExampleLine label="Pets">
          <Body small>Toxic to cats and dogs, per the ASPCA's list.</Body>
        </ExampleLine>
      </Card>

      <Card>
        <Heading>No photo to hand?</Heading>
        <Body small muted>
          Add a plant by name instead. Pick it from the list and its reminders set themselves; you can add a
          photo whenever you like.
        </Body>
        <Button title="Add by name" onPress={add} />
      </Card>
    </ScrollView>
  );
}

function ExampleLine({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.line, { borderTopColor: t.hairline }]}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2, maxWidth: 560, width: "100%", alignSelf: "center" },
  exampleLabel: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4, marginTop: space.sm },
  exampleHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  headText: { flex: 1, gap: 2 },
  line: { gap: space.xs, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  badges: { flexDirection: "row" },
  careRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
