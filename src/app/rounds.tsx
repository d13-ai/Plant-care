import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Field, Row, Title } from "@/components/ui";
import { confirm } from "@/lib/confirm";
import { PHOTO_SIZES } from "@/domain/photo-uri";
import { displayPhotoUri } from "@/lib/photo-uri";
import { leaveCard, myRounds, takeCardBack, type Round } from "@/lib/rounds";
import { photoUrl } from "@/lib/sync";
import { font, radius, space, useTheme } from "@/theme";

/**
 * The rounds: the conservatories whose cards you hold.
 *
 * Tapping one opens their conservatory, which is a real page on the web rather
 * than a screen in here — it is the same thing a stranger sees, and the same
 * thing you would send someone. There is no in-app copy of it to drift.
 */
export default function Rounds() {
  const t = useTheme();
  const router = useRouter();
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
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
  }, [refresh]);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await leaveCard(handle);
      setHandle("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Your rounds" }} />

      <Card>
        <Title>Your rounds</Title>
        <Body small muted>
          Leave your calling card at someone's conservatory and it shows up here. You see what
          they've put on show — nothing private, the same as anyone with their link.
        </Body>
        <Field
          label="Leave a card at"
          value={handle}
          onChangeText={setHandle}
          placeholder="ogBondstera"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
        />
        <Row>
          <Button
            title={busy ? "Leaving…" : "Leave a card"}
            variant="primary"
            small
            disabled={busy || handle.trim().length < 3}
            onPress={add}
          />
        </Row>
        {error ? <Body small style={{ color: t.critical.fg }}>{error}</Body> : null}
      </Card>

      {rounds === null ? null : rounds.length === 0 ? (
        <Body muted>
          No cards left yet. Ask a plant friend for their handle — it's the name at the end of their
          conservatory link.
        </Body>
      ) : (
        <View style={styles.list}>
          {rounds.map((r) => (
            <Pressable
              key={r.handle}
              onPress={() => Linking.openURL(r.url).catch(() => {})}
              onLongPress={() => remove(r)}
              accessibilityRole="link"
              accessibilityLabel={`Visit ${r.displayName}'s conservatory`}
              style={({ pressed }) => [styles.round, { borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.roundHead}>
                <View style={styles.roundText}>
                  <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{r.displayName}</Text>
                  <Body small muted>
                    @{r.handle} · {r.onShow} {r.onShow === 1 ? "plant" : "plants"} on show
                  </Body>
                </View>
                <Button title="Visit" small onPress={() => Linking.openURL(r.url).catch(() => {})} />
              </View>
              {r.photos.length > 0 ? (
                <View style={styles.strip}>
                  {r.photos.map((path) => (
                    <Image
                      key={path}
                      source={{ uri: displayPhotoUri(photoUrl(path), PHOTO_SIZES.thumb) }}
                      style={styles.shot}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              ) : null}
            </Pressable>
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
  round: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  roundHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  roundText: { flex: 1, gap: 2 },
  name: { fontFamily: font.serif, fontSize: 18 },
  strip: { flexDirection: "row", gap: space.sm },
  shot: { flex: 1, aspectRatio: 1, borderRadius: radius.md },
});
