/**
 * Which file on a device holds which account's greenhouse.
 *
 * Until 19 Oct 2026 a device had one greenhouse, and it belonged to whoever
 * signed in: a different account signing in took the plants already there
 * as its own and uploaded them, so one account's plants turned up in
 * another's. Now each account keeps its own file. The original one stays
 * with the account it already belonged to -- renaming it would orphan every
 * existing keeper's plants -- and any other account on the same device gets
 * a file of its own. One account on several devices is unchanged: each device
 * keeps a copy and the server keeps them the same.
 */

/** The file every device has used from the start. */
export const ORIGINAL_FILE = "plant-passport.db";

/**
 * Whose the original file is, when that is known only as "not this one":
 * its plants were already on the server under an account other than the one
 * that tried to adopt them. Nobody is handed it after that.
 */
export const SOMEONE_ELSE = "someone-else";

const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The file for an account that isn't the original file's. */
export function accountFile(userId: string): string {
  // An account id is a uuid; anything else in a file name is a bug.
  if (!ACCOUNT_ID.test(userId)) throw new Error("Not an account id.");
  return `parlour-${userId.toLowerCase()}.db`;
}

/** The file that holds `userId`'s greenhouse on this device. */
export function greenhouseFile(userId: string, originalOwner: string): string {
  return originalOwner === userId ? ORIGINAL_FILE : accountFile(userId);
}

/**
 * Whose the original file is, the first time anyone asks: the account that
 * last synced it. A file nobody has synced -- a new install, or plants added
 * before accounts were needed -- goes to the first account to sign in, which
 * is what always happened.
 */
export function originalOwner(keeperInFile: string | null, signingIn: string): string {
  return keeperInFile || signingIn;
}

/** A device setting that belongs to one account, stored under its id. */
export const accountKey = (key: string, userId: string) => `${key}@${userId}`;

/**
 * The settings a device keeps for the account signed in, each under
 * accountKey(). They were once kept per device -- so the name typed on one
 * account went up as another's -- and the first launch after the change
 * hands those to the original file's owner.
 */
export const ACCOUNT_SETTINGS = {
  /** The name on this keeper's tags. */
  name: "keeperName",
  /** Set while a name changed here hasn't reached the server. */
  nameUnsent: "keeperName:unsent",
  /** The half-filled Add plant form. */
  draft: "newPlantDraft",
  /** The last AI scan, kept for the screen after it. */
  lastScan: "ai:lastScan",
  /** "Keep every N days", per plant: this prefix and the plant's id. */
  keepWater: "pp:keep-water:",
} as const;
