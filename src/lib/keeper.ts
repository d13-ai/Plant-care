import AsyncStorage from "@react-native-async-storage/async-storage";

const KEEPER_NAME_KEY = "keeperName";

/** The name shown on this keeper's tags. Kept on-device; pushed with every sync. */
export async function getKeeperName(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEEPER_NAME_KEY)) ?? "";
  } catch {
    return "";
  }
}

export async function setKeeperName(name: string): Promise<void> {
  await AsyncStorage.setItem(KEEPER_NAME_KEY, name.trim());
}
