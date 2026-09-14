import { Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Badge, Body, Button, Card, Field, Heading, Row } from "@/components/ui";
import { pendingChanges } from "@/db";
import { sendEmailCode, signOut, useAccount, verifyEmailCode, type CodeMode } from "@/lib/auth";
import { confirm } from "@/lib/confirm";
import { supabaseConfigured } from "@/lib/supabase";
import { getSyncStatus, subscribeSync, syncNow, type SyncStatus } from "@/lib/sync";
import { space, useTheme } from "@/theme";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default function AccountScreen() {
  const t = useTheme();
  const db = useSQLiteContext();
  const { account, loading } = useAccount();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<CodeMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus());
  const [pending, setPending] = useState(0);

  useEffect(() => subscribeSync(setSync), []);
  useEffect(() => {
    pendingChanges(db).then(setPending);
  }, [db, sync]);

  const signedIn = Boolean(account && !account.anonymous);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const send = () => run(async () => setMode(await sendEmailCode(email)));
  const verify = () =>
    run(async () => {
      await verifyEmailCode(db, email, code, mode!);
      setCode("");
      setMode(null);
      syncNow(db).catch(() => {});
    });
  const leave = async () => {
    const ok = await confirm(
      "Sign out?",
      "Your plants stay on this phone, but they stop backing up until you sign in again.",
      { confirmText: "Sign out" },
    );
    if (ok) await run(() => signOut(db));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Account" }} />

      {!supabaseConfigured ? (
        <Card>
          <Heading>Not set up</Heading>
          <Body muted small>This build has no server configured, so there's nothing to sign into.</Body>
        </Card>
      ) : signedIn ? (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Heading>Account</Heading>
            <Badge
              label={sync.state === "syncing" ? "Syncing…" : sync.state === "error" ? "Sync failed" : "Backed up"}
              tone={sync.state === "error" ? "critical" : sync.state === "syncing" ? "attention" : "success"}
            />
          </Row>
          <Body>Signed in as {account!.email}</Body>
          <Body small muted>
            Your plants, photos and care history are saved to this account and show up on any phone you sign
            into. Last synced {ago(sync.lastSyncedAt)}
            {pending ? ` · ${pending} change${pending === 1 ? "" : "s"} waiting` : ""}.
          </Body>
          {sync.error ? (
            <Body small style={{ color: t.critical.fg } as never}>{sync.error}</Body>
          ) : null}
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
      ) : (
        <Card>
          <Heading>Back up your greenhouse</Heading>
          <Body small muted>
            Right now your plants live only on this phone. Add your email and they're saved to your account —
            and show up on any phone you sign into. No password: we email you a 6-digit code.
          </Body>
          {loading ? null : mode === null ? (
            <>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <Row>
                <Button title={busy ? "Sending…" : "Send code"} variant="primary" disabled={busy || !email.trim()} onPress={send} />
              </Row>
            </>
          ) : (
            <>
              <Body small>We sent a 6-digit code to {email.trim()}. It's good for an hour.</Body>
              <Field
                label="Code"
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
              />
              <Row>
                <Button title={busy ? "Checking…" : "Verify"} variant="primary" disabled={busy || code.replace(/\D/g, "").length < 6} onPress={verify} />
                <Button title="Send again" small disabled={busy} onPress={send} />
                <Button title="Use another email" small disabled={busy} onPress={() => { setMode(null); setCode(""); }} />
              </Row>
            </>
          )}
          {error ? (
            <Body small style={{ color: t.critical.fg } as never}>{error}</Body>
          ) : null}
        </Card>
      )}

      {signedIn ? (
        <Body small muted>
          Signing in on another phone with the same email brings this greenhouse over. Changes made on either
          phone reach the other the next time it opens.
        </Body>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
});
