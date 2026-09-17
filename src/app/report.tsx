import { Stack, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Field, Heading, SectionLabel } from "@/components/ui";
import { sendBugReport } from "@/lib/bug-report";
import { font, space, useTheme } from "@/theme";

/**
 * Report a bug. For the people testing this before it is finished.
 *
 * The text box is the part testers see; the part that makes a report useful
 * is the trail attached to it, which has been collecting since the app
 * started. So this deliberately does not insist on a description — a report
 * sent with nothing typed is still worth having.
 */
export default function Report() {
  const t = useTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setFailed(null);
    try {
      const result = await sendBugReport(note, db);
      setRef(result.ref);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Couldn't send the report.");
    } finally {
      setSending(false);
    }
  };

  if (ref) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Stack.Screen options={{ title: "Report a bug" }} />
        <Card>
          <Heading>Thank you — that helps</Heading>
          <Body>
            We have the report, along with what the app was doing just before you sent it.
          </Body>
          <Text style={[styles.ref, { color: t.goldText, backgroundColor: t.plum }]}>{ref}</Text>
          <Body small muted>
            If you mention this to us, quote that code and we can find exactly this report.
          </Body>
          <Button title="Back to the parlour" variant="primary" onPress={() => router.back()} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: "Report a bug" }} />
      <Card>
        <Heading>Something not right?</Heading>
        <Body muted>
          Tell us what you were doing and what happened. If you would rather not type anything,
          send it anyway — the report carries a record of what the app was doing, and that is
          usually the useful part.
        </Body>
        <Field
          label="What went wrong?"
          placeholder="I tapped the camera and it just spun…"
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={5}
          maxLength={4000}
          editable={!sending}
        />
        {failed ? (
          <Body small style={{ color: t.critical.fg }}>
            {failed}
          </Body>
        ) : null}
        <Button
          title={sending ? "Sending…" : "Send report"}
          variant="primary"
          disabled={sending}
          onPress={send}
        />
      </Card>

      <Card>
        <SectionLabel>What gets sent</SectionLabel>
        <Body small muted>
          Whatever you typed above, and a technical record: which screens you opened, whether
          syncing was working, any errors the app hit, your browser and screen size, and how many
          plants are on this device.
        </Body>
        <Body small muted>
          Not your photos, not your notes, and not what any of your plants are. Email addresses
          and access tokens are stripped out before anything is sent.
        </Body>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, maxWidth: 560, width: "100%", alignSelf: "center" },
  ref: {
    fontFamily: font.bold,
    fontSize: 20,
    letterSpacing: 2,
    textAlign: "center",
    paddingVertical: space.sm,
    borderRadius: 10,
    overflow: "hidden",
  },
});
