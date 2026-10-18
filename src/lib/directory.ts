import { toRound, type Round, type RoundRow } from "./rounds";
import { supabase } from "./supabase";

/**
 * The conservatory directory: the keepers who chose to be found.
 *
 * Listing is off until a keeper switches it on under What's on show, and a
 * listed conservatory with nothing on show stays out, since there would be
 * nothing to see. What each entry shows is what /@handle already shows, so
 * the directory publishes nothing new; it only makes a conservatory findable
 * by someone who doesn't have the link.
 */
export interface Listing extends Round {
  /** Their card is already in your rounds. */
  carded: boolean;
  /** It's your own conservatory. */
  mine: boolean;
}

type ListingRow = RoundRow & { carded: boolean; mine: boolean };

/**
 * Listed conservatories, newest on show first, narrowed by a search over
 * handle, display name, and the names and species of what's on show. The
 * search is the server's to clean (a leading @, wildcards, length).
 */
export async function browseConservatories(query: string): Promise<Listing[]> {
  const q = query.trim();
  const { data, error } = await supabase.rpc("conservatory_directory", q ? { q } : {});
  if (error) throw new Error(error.message);
  return ((data ?? []) as ListingRow[]).map((r) => ({
    ...toRound(r),
    carded: Boolean(r.carded),
    mine: Boolean(r.mine),
  }));
}
