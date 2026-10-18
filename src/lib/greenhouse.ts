import AsyncStorage from "@react-native-async-storage/async-storage";
import { GREENHOUSE_KEEPER } from "@/db";
import {
  ACCOUNT_SETTINGS,
  accountKey,
  greenhouseFile,
  ORIGINAL_FILE,
  originalOwner,
  SOMEONE_ELSE,
} from "@/domain/greenhouse";
import { supabase } from "./supabase";

/**
 * Which greenhouse on this device is whose -- see src/domain/greenhouse.ts.
 *
 * The one fact kept here is whose the original file is. It is read out of
 * the file once, the first time an account signs in after the change, and
 * remembered beside it from then on.
 */
const ORIGINAL_OWNER_KEY = "pp:original-greenhouse";

/** The database file to open for `userId`. */
export async function greenhouseFileFor(userId: string): Promise<string> {
  let owner = await AsyncStorage.getItem(ORIGINAL_OWNER_KEY);
  if (!owner) {
    owner = originalOwner(await keeperOfOriginal(), userId);
    await moveDeviceSettingsTo(owner);
    await AsyncStorage.setItem(ORIGINAL_OWNER_KEY, owner);
  }
  return greenhouseFile(userId, owner);
}

/** The original file holds plants already on the server under another
 *  account, so it is no longer handed to anyone. */
export async function originalBelongsElsewhere(): Promise<void> {
  await AsyncStorage.setItem(ORIGINAL_OWNER_KEY, SOMEONE_ELSE);
}

async function keeperOfOriginal(): Promise<string | null> {
  // Loaded here rather than at the top: sync reads this module's settings
  // helpers, and the e2e tests run sync in Node, where expo-sqlite can't load.
  const { openDatabaseAsync } = await import("expo-sqlite");
  // A connection of its own, closed before the app opens whichever file it
  // needs -- on the web only one connection may hold a file at a time.
  const db = await openDatabaseAsync(ORIGINAL_FILE, { useNewConnection: true });
  try {
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_meta WHERE key = ?", [
      GREENHOUSE_KEEPER,
    ]);
    return row?.value ?? null;
  } catch {
    // A brand-new file: no tables yet, so nobody's.
    return null;
  } finally {
    await db.closeAsync();
  }
}

const isDeviceWide = (key: string) =>
  key === ACCOUNT_SETTINGS.name ||
  key === ACCOUNT_SETTINGS.draft ||
  key === ACCOUNT_SETTINGS.lastScan ||
  (key.startsWith(ACCOUNT_SETTINGS.keepWater) && !key.includes("@"));

/**
 * Settings kept once per device before the change go to the account whose
 * plants they were kept beside.
 */
async function moveDeviceSettingsTo(owner: string): Promise<void> {
  try {
    const old = (await AsyncStorage.getAllKeys()).filter(isDeviceWide);
    if (!old.length) return;
    const moved: [string, string][] = [];
    for (const [key, value] of await AsyncStorage.multiGet(old)) {
      if (value === null) continue;
      moved.push([accountKey(key, owner), value]);
      // A name typed here went up with every sync. It goes up once more, and
      // from then on only when it is changed -- see src/lib/keeper.ts.
      if (key === ACCOUNT_SETTINGS.name && value.trim()) {
        moved.push([accountKey(ACCOUNT_SETTINGS.nameUnsent, owner), "1"]);
      }
    }
    await AsyncStorage.multiSet(moved);
    await AsyncStorage.multiRemove(old);
  } catch {
    /* settings, not plants: at worst something is asked for again */
  }
}

/** Where a per-account setting is kept for the account signed in now, or
 *  null when nobody is. */
export async function settingKey(key: string): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  return id ? accountKey(key, id) : null;
}

/** Every setting this device keeps for `userId`, gone -- when the account is. */
export async function forgetAccountSettings(userId: string): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.endsWith(`@${userId}`));
  await AsyncStorage.multiRemove(keys);
}
