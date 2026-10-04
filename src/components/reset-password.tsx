import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MonsteraIcon } from "@/components/icons";
import { Body, Button, Card, Field, Row, Title } from "@/components/ui";
import { resetPassword, type Account } from "@/lib/auth";
import { cardTheme, font, space, useTheme } from "@/theme";

/**
 * Where a reset link lands: plantparlour.org/?reset=<token>.
 *
 * Shown in place of everything else while the token is in the address bar,
 * signed in or not -- it is the one page that has to work for someone who
 * can't get in. Nothing happens on arrival; the token is spent only when the
 * button is pressed (see resetPassword), so a mail scanner that opened the
 * link first hasn't used it up.
 *
 * Someone already signed in on this device is stopped before anything is
 * spent. Using the link would sign this phone into whichever account the link
 * belongs to, and the plants already here would start syncing into it.
 */
export function ResetPassword({
  token,
  signedInAs,
  onDone,
}: {
  token: string;
  signedInAs: Account | null;
  onDone: () => void;
}) {
  const t = useTheme();
  // Who was signed in when the page opened, held still: using the link signs
  // this phone in, and the screen must not turn into "you're already signed
  // in" half-way through saving the new password.
  const [blockedBy] = useState(signedInAs);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = password.length >= 8;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: t.background }]}>
      <View style={styles.masthead}>
        <MonsteraIcon size={40} color={t.leaf} />
        <Text style={[styles.wordmark, { color: t.text }]}>PlantParlour</Text>
      </View>
      <Card>
        {blockedBy ? (
          <>
            <Title>You're already signed in</Title>
            <Body>
              This phone is signed in as {blockedBy.email ?? "another account"}. To reset a password, sign out
              first (Account, then Sign out), then open the link from your email again.
            </Body>
            <Row>
              <Button title="Go to your parlour" variant="primary" onPress={onDone} />
            </Row>
          </>
        ) : (
          <>
            <Title>Choose a new password</Title>
            <Field
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              hint="A capital letter and a number too."
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={() => ready && !busy && save()}
              returnKeyType="go"
            />
            <Row>
              <Button
                title={busy ? "One moment…" : "Save and sign in"}
                variant="primary"
                disabled={busy || !ready}
                onPress={save}
              />
            </Row>
            {error ? <Body small style={{ color: cardTheme.critical.fg } as never}>{error}</Body> : null}
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: space.lg,
    gap: space.lg,
    paddingVertical: space.xl * 2,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  masthead: { alignItems: "center", gap: space.sm },
  wordmark: { fontFamily: font.serifBold, fontSize: 30, lineHeight: 38, textAlign: "center" },
});
