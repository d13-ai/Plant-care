import { useEffect, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { Linking, StyleSheet, View } from "react-native";
import { Badge, Body, Button, Card, Heading, Row } from "@/components/ui";
import { getCareCard, type CareCard } from "@/lib/care-card";
import { supabaseConfigured } from "@/lib/supabase";
import { AI_TOXICITY_NOTICE, APCC, ASPCA_PLANT_LIST } from "@/domain/pet-safety";
import { cardTheme, space, useTheme, type Tone } from "@/theme";

const DIFFICULTY_TONE: Record<CareCard["difficulty"], Tone> = {
  easy: "success",
  moderate: "warning",
  fussy: "critical",
};

/**
 * The AI care guide for a plant's species — light, water, feeding, common
 * problems, toxicity. Loads the on-device copy instantly and otherwise
 * fetches it once (the guide is shared and cached server-side too).
 */
export function CareGuide({ species }: { species: string | null }) {
  const t = useTheme();
  const db = useSQLiteContext();
  const [card, setCard] = useState<CareCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!species?.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setCard(await getCareCard(db, species));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCard(null);
    if (species?.trim() && supabaseConfigured) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species]);

  if (!species?.trim()) {
    return (
      <Card>
        <Heading>Care guide</Heading>
        <Body small muted>Set this plant's species to get its care guide.</Body>
      </Card>
    );
  }

  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <Heading>Care guide</Heading>
        {card ? <Badge label={card.difficulty} tone={DIFFICULTY_TONE[card.difficulty]} /> : null}
      </Row>

      {loading && !card ? <Body small muted>Looking up care for {species}…</Body> : null}
      {error ? (
        <>
          <Body small style={{ color: t.critical.fg } as never}>{error}</Body>
          <Row><Button title="Try again" small onPress={load} /></Row>
        </>
      ) : null}

      {card ? (
        <View style={{ gap: space.sm }}>
          <Body small muted>{card.summary}</Body>
          {(
            [
              ["Light", card.light],
              ["Water", card.water],
              ["Humidity", card.humidity],
              ["Temperature", card.temperature],
              ["Soil", card.soil],
              ["Feeding", card.feeding],
              ["Repotting", card.repotting],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Body small style={[styles.label, { color: t.muted }] as never}>{label}</Body>
              <Body small style={{ flex: 1 } as never}>{value}</Body>
            </View>
          ))}

          {card.common_problems.length ? (
            <View style={{ gap: 4 }}>
              <Body small style={[styles.label, { color: t.muted }] as never}>Common problems</Body>
              {card.common_problems.map((p) => (
                <Body small key={p.problem}>• {p.problem} — {p.fix}</Body>
              ))}
            </View>
          ) : null}

          <View style={styles.row}>
            <Body small style={[styles.label, { color: t.muted }] as never}>Toxicity</Body>
            <Body small style={{ flex: 1 } as never}>{card.toxicity}</Body>
          </View>
          {/* Never shown without this: the AI is not the authority on whether a
              plant is safe around a pet or a child. See domain/pet-safety.ts. */}
          <View
            accessibilityRole="alert"
            // The card's own light palette: this sits on the cream card, not the page.
            style={[styles.notice, { backgroundColor: cardTheme.critical.bg, borderColor: cardTheme.critical.ring }]}
          >
            <Body small style={{ color: cardTheme.critical.fg } as never}>{AI_TOXICITY_NOTICE}</Body>
            <Row>
              <Button title="Check the ASPCA list" small onPress={() => Linking.openURL(ASPCA_PLANT_LIST).catch(() => {})} />
              <Button title={`Call ${APCC.phone}`} small onPress={() => Linking.openURL(APCC.tel).catch(() => {})} />
            </Row>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  label: { width: 96 },
  notice: { gap: space.sm, padding: space.md, borderRadius: 8, borderWidth: 1 },
});
