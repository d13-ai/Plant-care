import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACCOUNT_SETTINGS } from "@/domain/greenhouse";
import { settingKey } from "./greenhouse";
import type { Verdict } from "./ai";

/**
 * The add-plant screen's unsaved work, kept on the device so an accidental
 * back-swipe (or a reload on the web) doesn't lose the photo, the AI result
 * and everything typed. Cleared when the plant is saved or the keeper
 * chooses to start over.
 */
export interface NewPlantDraft {
  /** Up to three: the whole plant first, then close-ups. */
  photoUris: string[];
  /** Older drafts kept a single photo here. */
  photoUri?: string | null;
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


export function draftHasContent(d: Omit<NewPlantDraft, "savedAt">): boolean {
  return Boolean(d.photoUris?.length || d.photoUri || d.nickname.trim() || d.species.trim() || d.location.trim() || d.acquiredFrom.trim() || d.verdict);
}

export async function loadDraft(): Promise<NewPlantDraft | null> {
  try {
    // The signed-in account's own: an unsaved plant is nobody else's business.
    const key = await settingKey(ACCOUNT_SETTINGS.draft);
    const raw = key ? await AsyncStorage.getItem(key) : null;
    if (!raw) return null;
    const d = JSON.parse(raw) as NewPlantDraft;
    if (!d.photoUris) d.photoUris = d.photoUri ? [d.photoUri] : [];
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
    settingKey(ACCOUNT_SETTINGS.draft)
      .then((key) => (key ? AsyncStorage.setItem(key, JSON.stringify(draft)) : undefined))
      .catch(() => {});
  }, 400);
}

export async function clearDraft(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const key = await settingKey(ACCOUNT_SETTINGS.draft).catch(() => null);
  if (key) await AsyncStorage.removeItem(key).catch(() => {});
}
