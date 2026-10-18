import { HANDLE_RULE } from "@/domain/handle";
import { SITE_URL, supabase } from "./supabase";

/**
 * A keeper's handle: the name their conservatory lives at, and the first
 * thing about them that is globally unique rather than private to their
 * account. It is stored on the server for that reason — a name only this
 * device knew could be taken by somebody else tomorrow.
 */
export { HANDLE_RULE };

export function conservatoryUrl(handle: string): string {
  return `${SITE_URL}/@${handle}`;
}

/** Whatever this keeper's handle is, or null while they haven't chosen one. */
export async function getHandle(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const { data: row } = await supabase
    .from("keepers")
    .select("handle")
    .eq("id", data.session.user.id)
    .maybeSingle();
  return (row?.handle as string | null) ?? null;
}

/**
 * Their handle and whether the conservatory is listed in the directory, or
 * null while they have no handle (an unclaimed conservatory can't be listed).
 */
export async function getListing(): Promise<{ handle: string; listed: boolean } | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const { data: row, error } = await supabase
    .from("keepers")
    .select("handle, listed")
    .eq("id", data.session.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return row?.handle ? { handle: row.handle as string, listed: Boolean(row.listed) } : null;
}

/**
 * List the conservatory among the ones other keepers can browse, or take it
 * out. It publishes nothing: the directory shows what /@handle already does.
 */
export async function setListed(listed: boolean): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in first.");
  const { error } = await supabase
    .from("keepers")
    .update({ listed, updated_at: new Date().toISOString() })
    .eq("id", data.session.user.id);
  if (error) throw new Error(error.message);
}

/**
 * Claim a handle. Taken is the ordinary outcome, not an error worth showing
 * raw — Postgres reports it as a unique-index violation naming the index.
 */
export async function setHandle(handle: string): Promise<void> {
  const wanted = handle.trim();
  if (!HANDLE_RULE.test(wanted)) {
    throw new Error("Use 3 to 20 letters, numbers or underscores — no spaces.");
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in first.");

  const { error } = await supabase
    .from("keepers")
    .upsert({ id: data.session.user.id, handle: wanted, updated_at: new Date().toISOString() });
  if (!error) return;

  if (/duplicate key|keepers_handle_lower_idx|unique/i.test(error.message)) {
    throw new Error(`@${wanted} is taken. Try another.`);
  }
  // The reserved-name list lives in the database, so its refusal arrives here.
  if (/keepers_handle_not_reserved/i.test(error.message)) {
    throw new Error(`@${wanted} is spoken for. Try another.`);
  }
  if (/keepers_handle_shape/i.test(error.message)) {
    throw new Error("Use 3 to 20 letters, numbers or underscores — no spaces.");
  }
  throw new Error(error.message);
}
