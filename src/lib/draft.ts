import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Verdict } from "./ai";

/**
 * The add-plant screen's unsaved work, kept on the device so an accidental
 * back-swipe (or a reload on the web) doesn't lose the photo, the AI result
 * and everything typed. Cleared when the plant is saved or the keeper
 * chooses to start over.
 */
export interface NewPlantDraft {
  photoUri: string | null;
  nickname: string;
  species: string;
  /** The catalogue entry's scientific name, if one was picked. */
  pickedName: string | null;
  location: string;
  acquiredFrom: string;
  acquiredAt: string;
  motherId: string;
  verdict: Verdict | null;
  savedAt: string;
}

const KEY = "newPlantDraft";

export function draftHasContent(d: Omit<NewPlantDraft, "savedAt">): boolean {
  return Boolean(d.photoUri || d.nickname.trim() || d.species.trim() || d.location.trim() || d.acquiredFrom.trim() || d.verdict);
}

export async function loadDraft(): Promise<NewPlantDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as NewPlantDraft;
    return draftHasContent(d) ? d : null;
  } catch {
    return null;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Save soon; bursts of typing collapse into one write. */
export function saveDraftSoon(d: Omit<NewPlantDraft, "savedAt">): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const draft: NewPlantDraft = { ...d, savedAt: new Date().toISOString() };
    AsyncStorage.setItem(KEY, JSON.stringify(draft)).catch(() => {});
  }, 400);
}

export async function clearDraft(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
