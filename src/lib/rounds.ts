import { conservatoryUrl, HANDLE_RULE } from "./conservatory";
import { supabase } from "./supabase";

/**
 * Calling cards: following, in the register the rest of this is written in.
 * You leave your card at someone's conservatory and it joins your rounds.
 *
 * A card grants nothing. The rounds read the same published plants a stranger
 * sees at /@handle — a private plant is as invisible to someone holding your
 * card as to anyone else — so none of the row-level security that guards a
 * greenhouse had to be loosened to build this.
 */
export interface Round {
  handle: string;
  displayName: string;
  onShow: number;
  newest: string | null;
  /** Up to three photo paths from their most recently published plants. */
  photos: string[];
  url: string;
}

type RoundRow = {
  handle: string;
  display_name: string;
  on_show: number;
  newest: string | null;
  photos: string[];
};

export async function myRounds(): Promise<Round[]> {
  const { data, error } = await supabase.rpc("rounds");
  if (error) throw new Error(error.message);
  return ((data ?? []) as RoundRow[]).map((r) => ({
    handle: r.handle,
    displayName: r.display_name,
    onShow: Number(r.on_show ?? 0),
    newest: r.newest,
    photos: r.photos ?? [],
    url: conservatoryUrl(r.handle),
  }));
}

/** The three answers the function gives back, worded for a keeper. */
const REFUSALS: Record<string, string> = {
  "not signed in": "Sign in first.",
  "no such conservatory": "No conservatory at that name yet.",
  "that is your own": "That one's yours already.",
};

export async function leaveCard(handle: string): Promise<void> {
  const wanted = handle.trim().replace(/^@/, "");
  if (!HANDLE_RULE.test(wanted)) throw new Error("That isn't a handle — 3 to 20 letters, numbers or underscores.");
  const { data, error } = await supabase.rpc("leave_card", { handle: wanted });
  if (error) throw new Error(error.message);
  const answer = data as { ok: boolean; reason?: string };
  if (!answer?.ok) throw new Error(REFUSALS[answer?.reason ?? ""] ?? "That didn't work.");
}

export async function takeCardBack(handle: string): Promise<void> {
  const { error } = await supabase.rpc("take_card_back", { handle: handle.replace(/^@/, "") });
  if (error) throw new Error(error.message);
}
