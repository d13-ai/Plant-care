import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACCOUNT_SETTINGS, accountKey } from "@/domain/greenhouse";
import { settingKey } from "./greenhouse";

/**
 * The name shown on this keeper's tags. The account's, not the device's: kept
 * here for the account signed in, sent up when it is changed here, and
 * otherwise taken from the server -- so a phone that never had a name typed
 * into it can't blank the one typed on another.
 */
export async function getKeeperName(): Promise<string> {
  try {
    const key = await settingKey(ACCOUNT_SETTINGS.name);
    return (key && (await AsyncStorage.getItem(key))) || "";
  } catch {
    return "";
  }
}

export async function setKeeperName(name: string): Promise<void> {
  const key = await settingKey(ACCOUNT_SETTINGS.name);
  const unsent = await settingKey(ACCOUNT_SETTINGS.nameUnsent);
  if (!key || !unsent) throw new Error("Sign in first.");
  await AsyncStorage.multiSet([
    [key, name.trim()],
    [unsent, "1"],
  ]);
}

/** The name to send with the next sync, or undefined when this device has
 *  nothing new to say about it. */
export async function unsentKeeperName(userId: string): Promise<string | undefined> {
  const [[, name], [, unsent]] = await AsyncStorage.multiGet([
    accountKey(ACCOUNT_SETTINGS.name, userId),
    accountKey(ACCOUNT_SETTINGS.nameUnsent, userId),
  ]);
  return unsent ? (name ?? "") : undefined;
}

/** After a sync: the name the server holds now. A change made here while
 *  the sync was on its way still waits its turn. */
export async function keeperNameSynced(userId: string, sent: string | undefined, onServer: string | null): Promise<void> {
  const nameKey = accountKey(ACCOUNT_SETTINGS.name, userId);
  const unsentKey = accountKey(ACCOUNT_SETTINGS.nameUnsent, userId);
  const [[, name], [, unsent]] = await AsyncStorage.multiGet([nameKey, unsentKey]);
  if (unsent) {
    if (sent !== undefined && (name ?? "") === sent) await AsyncStorage.removeItem(unsentKey);
    return;
  }
  await AsyncStorage.setItem(nameKey, onServer ?? "");
}
