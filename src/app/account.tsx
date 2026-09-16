import { Stack, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet } from "react-native";
import { Badge, Body, Button, Card, Heading, Row } from "@/components/ui";
import { pendingChanges } from "@/db";
import { signOut, useAccount } from "@/lib/auth";
import { confirm } from "@/lib/confirm";
import { getSyncStatus, subscribeSync, syncNow, type SyncStatus } from "@/lib/sync";
import { cardTheme, space } from "@/theme";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * The signed-in account: where the greenhouse is backed up to, and the way
 * out. Signing in itself lives on the welcome screen now — nobody reaches
 * this screen without an account, because `RequireAccount` stands in front of
 * every route.
 */
export default function AccountScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { account } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus());
  const [pending, setPending] = useState(0);

  useEffect(() => subscribeSync(setSync), []);
  useEffect(() => {
    pendingChanges(db).then(setPending);
  }, [db, sync]);

  // Google's redirect lands here. Start the first sync, and tidy the tokens it
  // leaves in the URL.
  useEffect(() => {
    syncNow(db).catch(() => {});
    if (Platform.OS === "web" && /access_token|refresh_token|error/.test(window.location.hash)) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [db]);

  const leave = async () => {
    const ok = await confirm(
      "Sign out?",
      "Your greenhouse stays in your account. This phone stops showing it until you sign in again.",
      { confirmText: "Sign out" },
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await signOut(db);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Account" }} />

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Heading>Account</Heading>
          <Badge
            label={sync.state === "syncing" ? "Syncing…" : sync.state === "error" ? "Sync failed" : "Backed up"}
            tone={sync.state === "error" ? "critical" : sync.state === "syncing" ? "attention" : "success"}
          />
        </Row>
        <Body>Signed in as {account?.email}</Body>
        <Body small muted>
          Your plants, photos and care history are saved to this account and show up on any phone you sign
          into. Last synced {ago(sync.lastSyncedAt)}
          {pending ? ` · ${pending} change${pending === 1 ? "" : "s"} waiting` : ""}.
        </Body>
        {sync.error ? <Body small style={{ color: cardTheme.critical.fg }}>{sync.error}</Body> : null}
        {error ? <Body small style={{ color: cardTheme.critical.fg }}>{error}</Body> : null}
        <Row>
          <Button
            title={sync.state === "syncing" ? "Syncing…" : "Sync now"}
            variant="primary"
            small
            disabled={sync.state === "syncing"}
            onPress={() => syncNow(db).catch(() => {})}
          />
          <Button title="Sign out" small disabled={busy} onPress={leave} />
        </Row>
      </Card>

      <Body small muted>
        Signing in on another phone with the same email brings this greenhouse over. Changes made on either
        phone reach the other the next time it opens. A photo taken with no signal saves here and uploads on
        the next sync.
      </Body>

      {/* Landing here from a sign-in redirect is a fresh page load, so there is
          no history to go back to and the modal's own dismiss never appears.
          Without this the screen is a dead end. */}
      <Row>
        <Button
          title="Go to the parlour"
          variant="primary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
      </Row>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
});
