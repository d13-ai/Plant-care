import { handleFrom } from "@/domain/handle";
import { conservatoryUrl } from "./conservatory";
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

/** A row as rounds() and conservatory_directory() send it. */
export type RoundRow = {
  handle: string;
  display_name: string;
  on_show: number;
  newest: string | null;
  photos: string[];
};

export function toRound(r: RoundRow): Round {
  return {
    handle: r.handle,
    displayName: r.display_name,
    onShow: Number(r.on_show ?? 0),
    newest: r.newest,
    photos: r.photos ?? [],
    url: conservatoryUrl(r.handle),
  };
}

export async function myRounds(): Promise<Round[]> {
  const { data, error } = await supabase.rpc("rounds");
  if (error) throw new Error(error.message);
  return ((data ?? []) as RoundRow[]).map(toRound);
}

const NOT_A_HANDLE = "That isn't a handle — 3 to 20 letters, numbers or underscores.";

/** What conservatory() answers: the same thing /@handle renders. */
type ConservatoryPage = {
  keeper: { handle: string; display_name: string; keeping_since: string | null };
  plants: { photo: string | null }[];
};

/**
 * One conservatory, by its exact handle or a pasted link to it, or null when
 * nobody has that handle. It reads what /@handle shows a stranger and
 * nothing else, so finding someone this way needs nothing from them but the
 * name — and works whether or not they have listed themselves.
 */
export async function lookUpKeeper(input: string): Promise<Round | null> {
  const handle = handleFrom(input);
  if (!handle) throw new Error(NOT_A_HANDLE);
  const { data, error } = await supabase.rpc("conservatory", { handle });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const page = data as ConservatoryPage;
  return toRound({
    handle: page.keeper.handle,
    display_name: page.keeper.display_name,
    on_show: page.plants.length,
    newest: null,
    photos: page.plants.flatMap((p) => (p.photo ? [p.photo] : [])).slice(0, 3),
  });
}

/** The three answers the function gives back, worded for a keeper. */
const REFUSALS: Record<string, string> = {
  "not signed in": "Sign in first.",
  "no such conservatory": "No conservatory at that name yet.",
  "that is your own": "That one's yours already.",
};

export async function leaveCard(handle: string): Promise<void> {
  const wanted = handleFrom(handle);
  if (!wanted) throw new Error(NOT_A_HANDLE);
  const { data, error } = await supabase.rpc("leave_card", { handle: wanted });
  if (error) throw new Error(error.message);
  const answer = data as { ok: boolean; reason?: string };
  if (!answer?.ok) throw new Error(REFUSALS[answer?.reason ?? ""] ?? "That didn't work.");
}

export async function takeCardBack(handle: string): Promise<void> {
  const { error } = await supabase.rpc("take_card_back", { handle: handle.replace(/^@/, "") });
  if (error) throw new Error(error.message);
}
