import { REPEAT_PROMPT, loggedToday, type CareType } from "@/domain/care";
import { confirm } from "./confirm";

/**
 * Before logging care "now": if the same kind was already logged today, ask
 * — "Looks like you already watered today. Are you watering again?" —
 * and resolve to whether the keeper said yes. Back-dated entries and care
 * that's fine to repeat (photos, notes, issues) pass straight through.
 */
export async function okToLog(
  type: CareType,
  events: { type: string; occurredAt: string | Date }[],
  occurredAt?: string | null,
): Promise<boolean> {
  const words = REPEAT_PROMPT[type];
  if (!words || occurredAt || !loggedToday(events, type)) return true;
  return confirm(`Looks like you already ${words.past} today.`, `Are you ${words.gerund} again?`, {
    confirmText: "Yes, log it",
  });
}
