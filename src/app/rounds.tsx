import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ConservatoryCard, LeaveCardFooter } from "@/components/conservatory-card";
import { Body, Button, Card, Field, Row, Title } from "@/components/ui";
import { confirm } from "@/lib/confirm";
import { getHandle } from "@/lib/conservatory";
import { handleFrom, sameHandle } from "@/domain/handle";
import { leaveCard, lookUpKeeper, myRounds, takeCardBack, type Round } from "@/lib/rounds";
import { space, useTheme } from "@/theme";

/**
 * The rounds: the conservatories whose cards you hold.
 *
 * Someone new is found by their exact handle (or their link, pasted) and
 * shown before a card is left, so a typo lands on "nobody by that name" or
 * on a stranger's face rather than silently in your rounds. The directory is
 * one button away for keepers who'd rather browse; a handle finds anyone,
 * listed or not, since the conservatory itself is public either way.
 */
export default function Rounds() {
  const t = useTheme();
  const router = useRouter();
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  // What the last lookup found: a conservatory, nobody (with the handle that
  // was looked for), or nothing asked yet.
  const [found, setFound] = useState<{ round: Round | null; asked: string } | null>(null);
  const [finding, setFinding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRounds(await myRounds());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    refresh();
    getHandle().then(setMine).catch(() => {});
  }, [refresh]);

  const find = async () => {
    setFinding(true);
    setError(null);
    setFound(null);
    try {
      const asked = handleFrom(typed) ?? typed.trim();
      setFound({ round: await lookUpKeeper(typed), asked });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFinding(false);
    }
  };

  const leave = async (round: Round) => {
    setLeaving(true);
    setError(null);
    try {
      await leaveCard(round.handle);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLeaving(false);
    }
  };

  const remove = async (round: Round) => {
    const ok = await confirm(
      `Take your card back from ${round.displayName}?`,
      "Their conservatory leaves your rounds. You can leave another any time.",
      { confirmText: "Take it back" },
    );
    if (!ok) return;
    try {
      await takeCardBack(round.handle);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const carded = (handle: string) => !!rounds?.some((r) => sameHandle(r.handle, handle));

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Your rounds" }} />

      <Card>
        <Title>Your rounds</Title>
        <Body small muted>
          Leave your calling card at someone's conservatory and it shows up here. You see what
          they've put on show — nothing private, the same as anyone with their link.
        </Body>
        <Field
          label="Find a keeper"
          value={typed}
          onChangeText={(text) => {
            setTyped(text);
            setFound(null);
          }}
          onSubmitEditing={() => handleFrom(typed) && find()}
          placeholder="@ogBondstera"
          hint="Their handle exactly, or paste their conservatory link."
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          maxLength={80}
        />
        <Row>
          <Button
            title={finding ? "Finding…" : "Find"}
            variant="primary"
            small
            disabled={finding || !handleFrom(typed)}
            onPress={find}
          />
          <Button title="Browse conservatories" small onPress={() => router.push("/conservatories")} />
        </Row>
        {error ? <Body small style={{ color: t.critical.fg }}>{error}</Body> : null}
        {found?.round ? (
          <ConservatoryCard
            round={found.round}
            footer={
              <LeaveCardFooter
                mine={sameHandle(found.round.handle, mine)}
                carded={carded(found.round.handle)}
                busy={leaving}
                onLeave={() => leave(found.round!)}
              />
            }
          />
        ) : found ? (
          <Body small muted>
            No conservatory at @{found.asked}. Handles are exact — check the spelling with them.
          </Body>
        ) : null}
      </Card>

      {rounds === null ? null : rounds.length === 0 ? (
        <Body muted>
          No cards left yet. Ask a plant friend for their handle — it's the name at the end of their
          conservatory link — or browse the conservatories keepers have listed.
        </Body>
      ) : (
        <View style={styles.list}>
          {rounds.map((r) => (
            <ConservatoryCard key={r.handle} round={r} onLongPress={() => remove(r)} />
          ))}
          <Body small muted>Press and hold a conservatory to take your card back.</Body>
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
  list: { gap: space.md },
});
