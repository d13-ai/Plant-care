import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Body, Button, Chips, Field, Row } from "@/components/ui";
import { AI_REPORT_NOTE_MAX, AI_REPORT_REASONS, type AiReportReason, type AiSurface } from "@/domain/ai-report";
import { reportAiAnswer } from "@/lib/bug-report";
import { space, useTheme } from "@/theme";

/**
 * "Report this answer", under anything the AI said. Quiet until pressed: it
 * is for the rare answer that is wrong or worse, and shouldn't compete with
 * the answer itself.
 */
export function ReportAnswer({
  surface,
  answer,
  species,
}: {
  surface: AiSurface;
  answer: unknown;
  species?: string | null;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<AiReportReason>("wrong");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return <Body small muted>Thanks — reported ({sent}). We read every one.</Body>;
  }

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} hitSlop={8}>
        <Text style={{ color: t.muted, fontSize: 13, textDecorationLine: "underline" }}>Report this answer</Text>
      </Pressable>
    );
  }

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const { ref } = await reportAiAnswer({ surface, reason, note, answer, species });
      setSent(ref);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the report.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <Body small>What's wrong with this answer?</Body>
      <Chips options={AI_REPORT_REASONS} value={reason} onChange={setReason} />
      <Field
        label="Anything to add? (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={AI_REPORT_NOTE_MAX}
      />
      {error ? <Body small style={{ color: t.critical.fg } as never}>{error}</Body> : null}
      <Row>
        <Button title={sending ? "Sending…" : "Send report"} small variant="primary" disabled={sending} onPress={send} />
        <Button title="Cancel" small onPress={() => setOpen(false)} />
      </Row>
    </View>
  );
}
