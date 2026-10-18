import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ConservatoryCard, LeaveCardFooter } from "@/components/conservatory-card";
import { Body, Button, Card, Field, Row, Title } from "@/components/ui";
import { browseConservatories, type Listing } from "@/lib/directory";
import { leaveCard } from "@/lib/rounds";
import { space, useTheme } from "@/theme";

/**
 * Conservatories: the ones their keepers chose to list, to browse and search.
 *
 * Only listed conservatories with something on show are here. Anyone else is
 * still found by handle from Your rounds — listing makes a conservatory
 * findable, and not listing doesn't make it private, so this screen says so
 * rather than implying a keeper who isn't here doesn't exist.
 */
export default function Conservatories() {
  const t = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A search per pause in typing, not per letter, and only the newest answer
  // lands: a slow reply for "ho" must not replace the one for "hoya".
  useEffect(() => {
    let current = true;
    const timer = setTimeout(
      () => {
        browseConservatories(query)
          .then((found) => {
            if (!current) return;
            setRows(found);
            setError(null);
          })
          .catch((err) => current && setError(err instanceof Error ? err.message : String(err)));
      },
      query.trim() ? 300 : 0,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  const leave = async (listing: Listing) => {
    setLeaving(listing.handle);
    setError(null);
    try {
      await leaveCard(listing.handle);
      setRows((all) => all?.map((r) => (r.handle === listing.handle ? { ...r, carded: true } : r)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLeaving(null);
    }
  };

  const searched = query.trim();
  const listedMine = rows?.some((r) => r.mine) ?? false;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Conservatories" }} />

      <Card>
        <Title>Conservatories</Title>
        <Body small muted>
          Keepers who've chosen to list their conservatory. You see only what they've put on show.
          Leave a card and they join your rounds.
        </Body>
        <Field
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="A name, a handle or a plant — hoya, @amanda…"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          maxLength={40}
        />
        {error ? <Body small style={{ color: t.critical.fg }}>{error}</Body> : null}
      </Card>

      {rows === null ? null : rows.length === 0 ? (
        <Body muted>
          {searched
            ? `Nothing listed matches “${searched}”. Not every keeper lists theirs — if you have their handle, find them from Your rounds.`
            : "No one has listed their conservatory yet."}
        </Body>
      ) : (
        <View style={styles.list}>
          {rows.map((r) => (
            <ConservatoryCard
              key={r.handle}
              round={r}
              footer={
                <LeaveCardFooter mine={r.mine} carded={r.carded} busy={leaving === r.handle} onLeave={() => leave(r)} />
              }
            />
          ))}
        </View>
      )}

      {listedMine ? null : (
        <Card>
          <Body small muted>
            Want yours here? Switch on “List my conservatory” under What's on show. It shows the same
            plants your conservatory link already does — nothing more.
          </Body>
          <Row>
            <Button title="What's on show" small onPress={() => router.push("/on-show")} />
          </Row>
        </Card>
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
