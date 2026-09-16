import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GoogleIcon } from "@/components/icons";
import { Body, Button, Field, Row, Title } from "@/components/ui";
import { sendEmailCode, signInWithGoogle, verifyEmailCode, type CodeMode } from "@/lib/auth";
import { cardTheme, font, radius, space, useTheme } from "@/theme";

/**
 * Signing in: Google in one tap, or an email and a 6-digit code. No passwords.
 *
 * It lives in its own component because it is the front door now — the welcome
 * screen is the only thing an unsigned-in visitor sees — rather than a panel
 * tucked inside the account screen.
 */
export function SignIn({ heading }: { heading?: string }) {
  const t = useTheme();
  const db = useSQLiteContext();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<CodeMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const verify = () =>
    run(async () => {
      await verifyEmailCode(db, email, code, mode!);
      setCode("");
      setMode(null);
    });

  return (
    <>
      {heading ? <Title>{heading}</Title> : null}
      {Platform.OS === "web" ? (
        <>
          <GoogleButton onPress={() => run(signInWithGoogle)} disabled={busy} />
          <View style={styles.divider}>
            <View style={[styles.rule, { backgroundColor: cardTheme.hairline }]} />
            <Body small muted>or use your email</Body>
            <View style={[styles.rule, { backgroundColor: cardTheme.hairline }]} />
          </View>
        </>
      ) : null}
      {mode === null ? (
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
            <Button
              title={busy ? "Sending…" : "Email me a code"}
              variant="primary"
              disabled={busy || !email.trim()}
              onPress={send}
            />
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
            <Button
              title={busy ? "Checking…" : "Verify"}
              variant="primary"
              disabled={busy || code.replace(/\D/g, "").length < 6}
              onPress={verify}
            />
            <Button title="Send again" small disabled={busy} onPress={send} />
            <Button title="Use another email" small disabled={busy} onPress={() => { setMode(null); setCode(""); }} />
          </Row>
        </>
      )}
      {error ? <Body small style={{ color: cardTheme.critical.fg } as never}>{error}</Body> : null}
    </>
  );
}

function GoogleButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
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
