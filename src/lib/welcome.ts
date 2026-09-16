import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/**
 * Whether this device has been through the welcome screen. A device flag,
 * not a keeper one: it decides what the very first launch shows, before
 * there is an account to hang anything off.
 */
const KEY = "welcomeSeen";

/**
 * Also held in memory for this run. The greenhouse redirects to the welcome
 * screen whenever the flag reads false, so a write that fails — or that is
 * still in flight when the screen navigates — would bounce the keeper
 * straight back and keep doing it. Neither is worth a loop.
 */
let seenThisRun = false;

/** Unreadable storage counts as seen, for the same reason. */
export async function welcomeSeen(): Promise<boolean> {
  if (seenThisRun) return true;
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return true;
  }
}

export async function markWelcomeSeen(): Promise<void> {
  seenThisRun = true;
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {
    // In memory is enough to get through this run; next launch asks again.
  }
}

/** `seen` is null until the flag has been read. */
export function useWelcomeSeen(): { seen: boolean | null; markSeen: () => Promise<void> } {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    welcomeSeen().then((value) => {
      if (live) setSeen(value);
    });
    return () => {
      live = false;
    };
  }, []);

  // Await this before navigating: the greenhouse reads the flag fresh on
  // mount, and it has to find it set.
  const markSeen = useCallback(async () => {
    setSeen(true);
    await markWelcomeSeen();
  }, []);

  return { seen, markSeen };
}
