import { Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GoogleIcon } from "@/components/icons";
import { Badge, Body, Button, Card, Field, Heading, Row, Title } from "@/components/ui";
import { pendingChanges } from "@/db";
import { sendEmailCode, signInWithGoogle, signOut, useAccount, verifyEmailCode, type CodeMode } from "@/lib/auth";
import { confirm } from "@/lib/confirm";
import { supabaseConfigured } from "@/lib/supabase";
import { getSyncStatus, subscribeSync, syncNow, type SyncStatus } from "@/lib/sync";
import { font, radius, space, cardTheme, useTheme } from "@/theme";

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

  // Landing here signed in — straight from Google, or after a code — starts
  // the first sync, and tidies the tokens Google's redirect leaves in the URL.
  useEffect(() => {
    if (!signedIn) return;
    syncNow(db).catch(() => {});
    if (Platform.OS === "web" && /access_token|refresh_token|error/.test(window.location.hash)) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [signedIn, db]);

  // Google can bounce back with an error in the URL instead of a session.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const description = params.get("error_description");
    if (description) setError(description.replace(/\+/g, " "));
  }, []);

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
  const google = () => run(signInWithGoogle);
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
            <Body small style={{ color: cardTheme.critical.fg } as never}>{sync.error}</Body>
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
          <View style={{ gap: space.xs }}>
            <Title>Sign in</Title>
            <Body small muted>
              Your plants live only on this phone until you do. Sign in and they're saved to your account and
              show up on any phone you sign into.
            </Body>
          </View>
          {Platform.OS === "web" ? (
            <>
              <GoogleButton onPress={google} disabled={busy || loading} />
              <View style={styles.divider}>
                <View style={[styles.rule, { backgroundColor: cardTheme.hairline }]} />
                <Body small muted>or use your email</Body>
                <View style={[styles.rule, { backgroundColor: cardTheme.hairline }]} />
              </View>
            </>
          ) : null}
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
                <Button title={busy ? "Sending…" : "Email me a code"} variant="primary" disabled={busy || !email.trim()} onPress={send} />
              </Row>
              <Body small muted>No password — we email you a 6-digit code to type in.</Body>
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
            <Body small style={{ color: cardTheme.critical.fg } as never}>{error}</Body>
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

function GoogleButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel="Continue with Google"
      style={({ pressed }) => [
        styles.google,
        { backgroundColor: "#FFFFFF", borderColor: cardTheme.plum, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      <GoogleIcon size={20} />
      <Text style={[styles.googleText, { color: cardTheme.text }]}>Continue with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  google: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  googleText: { fontSize: 15, fontFamily: font.bold, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
