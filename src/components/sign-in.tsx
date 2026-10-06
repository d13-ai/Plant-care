import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GoogleIcon } from "@/components/icons";
import { Body, Button, Field, Row, Title } from "@/components/ui";
import { requestPasswordReset, signInOrUp, signInWithGoogle } from "@/lib/auth";
import { cardTheme, font, radius, space, useTheme } from "@/theme";

/**
 * Signing in: Google in one tap, or an email and a password.
 *
 * It lives in its own component because it is the front door now — the welcome
 * screen is the only thing an unsigned-in visitor sees — rather than a panel
 * tucked inside the account screen.
 *
 * It touches no database. Someone who has not signed in has no plants on this
 * device, so opening one to let them sign in only created a way for signing in
 * to fail.
 */
export function SignIn({ heading }: { heading?: string }) {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Forgotten passwords are a second state of the same card rather than a
  // screen of their own: the email typed above carries straight over.
  const [forgot, setForgot] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);

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

  const ready = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 8;
  const enter = () => run(async () => { await signInOrUp(email, password); });
  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const askForLink = () =>
    run(async () => {
      await requestPasswordReset(email);
      setLinkSentTo(email.trim().toLowerCase());
    });
  const leaveForgot = () => {
    setForgot(false);
    setLinkSentTo(null);
    setError(null);
  };

  if (forgot) {
    return (
      <>
        <Title>Forgot your password?</Title>
        {linkSentTo ? (
          <>
            {/* Worded for both cases on purpose: the function answers the
                same whether or not the address has an account. */}
            <Body>
              If there's a PlantParlour account for {linkSentTo}, we've emailed it a link to choose a new
              password. It can take a minute or two — check your spam folder if it hasn't arrived.
            </Body>
            <Row>
              <Button title="Back to sign in" variant="primary" onPress={leaveForgot} />
            </Row>
          </>
        ) : (
          <>
            <Body muted>We'll email you a link to choose a new one.</Body>
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
              onSubmitEditing={() => emailOk && !busy && askForLink()}
              returnKeyType="send"
            />
            <Row>
              <Button
                title={busy ? "Sending…" : "Email me a link"}
                variant="primary"
                disabled={busy || !emailOk}
                onPress={askForLink}
              />
              <Button title="Back" onPress={leaveForgot} disabled={busy} />
            </Row>
            <Body small muted>Signed up with Google? You don't need a password — use Continue with Google.</Body>
          </>
        )}
        {error ? <Body small style={{ color: cardTheme.critical.fg } as never}>{error}</Body> : null}
      </>
    );
  }

  return (
    <>
      {heading ? <Title>{heading}</Title> : null}
      <GoogleButton onPress={() => run(signInWithGoogle)} disabled={busy} />
      <View style={styles.divider}>
        <View style={[styles.rule, { backgroundColor: cardTheme.hairline }]} />
        <Body small muted>or use your email</Body>
        <View style={[styles.rule, { backgroundColor: cardTheme.hairline }]} />
      </View>
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
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        hint="A capital letter and a number too."
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => ready && !busy && enter()}
        returnKeyType="go"
      />
      <Row>
        <Button
          title={busy ? "One moment…" : "Continue"}
          variant="primary"
          disabled={busy || !ready}
          onPress={enter}
        />
      </Row>
      <Body small muted>
        New here? This makes your parlour. Already have one? It signs you in.
      </Body>
      <Pressable
        onPress={() => {
          setError(null);
          setForgot(true);
        }}
        accessibilityRole="button"
      >
        <Text style={[styles.forgot, { color: cardTheme.plum }]}>Forgot your password?</Text>
      </Pressable>
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
  forgot: { fontSize: 15, fontFamily: font.bold, fontWeight: "700", textDecorationLine: "underline" },
});
