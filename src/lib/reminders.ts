import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { getCachedCareCard, listPlants } from "@/db";
import { careStatuses } from "@/domain/care";
import {
  DEFAULT_REMINDER_PREFS,
  outstanding,
  planReminders,
  shortHowTo,
  staleShown,
  type ReminderPlant,
  type ReminderPrefs,
} from "@/domain/reminders";
import type { CareCard } from "./care-card";
import { keyFor } from "./care-card";

/**
 * Care reminders on the phone itself: the app works out what's coming
 * (src/domain/reminders.ts) and queues it with the operating system, which
 * delivers it on time whether or not the app is running. Nothing is sent from
 * a server and nothing leaves the phone.
 *
 * The queue is planned again whenever something could have changed it — the
 * app opening or going to the background, a sync bringing in care logged on
 * another device, the settings changing — and on each pass anything on the
 * lock screen whose care has since been done is cleared away.
 *
 * Android and iOS only. On the web, "Add to calendar" on a plant does the job.
 */
export const remindersAvailable = Platform.OS !== "web";

/** The Android notification channel; its name is what a keeper sees in the phone's settings. */
const CHANNEL_ID = "care";

const PREFS_KEY = "reminderPrefs";
const PROMPT_KEY = "reminderPromptAnswered";

export interface StoredReminderPrefs extends ReminderPrefs {
  /** Off until the keeper turns reminders on: nothing is ever queued unasked. */
  enabled: boolean;
}

export async function loadReminderPrefs(): Promise<StoredReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<StoredReminderPrefs>) : {};
    return { enabled: false, ...DEFAULT_REMINDER_PREFS, ...saved };
  } catch {
    return { enabled: false, ...DEFAULT_REMINDER_PREFS };
  }
}

export async function saveReminderPrefs(prefs: StoredReminderPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/** Whether the greenhouse's "Want reminders?" card has had its answer. */
export async function reminderPromptAnswered(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PROMPT_KEY)) !== null;
  } catch {
    return true;
  }
}

export async function answerReminderPrompt(answer: "on" | "later"): Promise<void> {
  await AsyncStorage.setItem(PROMPT_KEY, answer).catch(() => {});
}

export type ReminderPermission = "granted" | "denied" | "undetermined";

export async function reminderPermission(): Promise<ReminderPermission> {
  if (!remindersAvailable) return "denied";
  const N = await import("expo-notifications");
  const p = await N.getPermissionsAsync();
  return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
}

/** Android shows its permission question only once a channel exists, so the channel comes first. */
async function ensureChannel(N: typeof import("expo-notifications")): Promise<void> {
  if (Platform.OS !== "android") return;
  await N.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Care reminders",
    description: "When a plant needs water, feeding, repotting or a new photo.",
    importance: N.AndroidImportance.DEFAULT,
  });
}

/**
 * Ask the phone for permission (the system's own question) and, given it,
 * switch reminders on. Returns whether they are on.
 */
export async function turnRemindersOn(db: SQLiteDatabase): Promise<boolean> {
  if (!remindersAvailable) return false;
  const N = await import("expo-notifications");
  await ensureChannel(N);
  const current = await N.getPermissionsAsync();
  const granted = current.granted || (current.canAskAgain && (await N.requestPermissionsAsync()).granted);
  if (!granted) return false;
  await saveReminderPrefs({ ...(await loadReminderPrefs()), enabled: true });
  await refreshReminders(db);
  return true;
}

/** The plants as the planner wants them: statuses, plus the guide's advice where the guide is on the phone. */
async function reminderPlants(db: SQLiteDatabase): Promise<ReminderPlant[]> {
  const all = await listPlants(db);
  const plants: ReminderPlant[] = [];
  for (const { plant, events } of all) {
    // A plant that has died needs nothing more.
    if (plant.status === "DECEASED") continue;
    const card = plant.species ? await getCachedCareCard<CareCard>(db, keyFor(plant.species)).catch(() => null) : null;
    plants.push({
      id: plant.id,
      nickname: plant.nickname,
      statuses: careStatuses(plant, events),
      howTo: card
        ? { WATER: shortHowTo(card.water), FERTILIZE: shortHowTo(card.feeding), REPOT: shortHowTo(card.repotting) }
        : undefined,
    });
  }
  return plants;
}

let running: Promise<void> = Promise.resolve();

/**
 * Plan the queue again from what is in the greenhouse now. Passes run one at
 * a time; a pass asked for while one is running follows it.
 */
export function refreshReminders(db: SQLiteDatabase): Promise<void> {
  if (!remindersAvailable) return Promise.resolve();
  running = running.then(() => replan(db)).catch((err) => {
    console.warn("Planning reminders failed:", err instanceof Error ? err.message : String(err));
  });
  return running;
}

async function replan(db: SQLiteDatabase): Promise<void> {
  const N = await import("expo-notifications");
  const prefs = await loadReminderPrefs();
  const plants = await reminderPlants(db);

  // Clear the lock screen of care that's been done, whatever the settings:
  // switching reminders off shouldn't leave a stale one behind.
  const shown = (await N.getPresentedNotificationsAsync()).map((n) => {
    const items = n.request.content.data?.items;
    return { id: n.request.identifier, items: Array.isArray(items) ? items.map(String) : [] };
  });
  for (const id of staleShown(shown, outstanding(plants))) {
    await N.dismissNotificationAsync(id).catch(() => {});
  }

  await N.cancelAllScheduledNotificationsAsync();
  if (!prefs.enabled) return;
  if (!(await N.getPermissionsAsync()).granted) return;
  await ensureChannel(N);

  for (const r of planReminders(plants, prefs)) {
    await N.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { items: r.items, plantId: r.plantId } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL_ID },
    });
  }
}

/** Signing out or deleting the account: nothing queued for plants this phone no longer shows. */
export async function stopReminders(): Promise<void> {
  if (!remindersAvailable) return;
  try {
    const N = await import("expo-notifications");
    await N.cancelAllScheduledNotificationsAsync();
    await N.dismissAllNotificationsAsync();
  } catch {
    /* nothing was queued */
  }
}
