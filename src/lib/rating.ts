import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import { RATING_ASKED_KEY } from "@/domain/rating";
import { PLAY_STORE_APP_URL, PLAY_STORE_URL } from "@/domain/store-listing";

/** Whether the rating card has been answered on this phone. */
export async function ratingAnswered(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(RATING_ASKED_KEY)) !== null;
  } catch {
    // Unreadable is treated as answered: never ask on a guess.
    return true;
  }
}

export async function answerRating(answer: "rate" | "later"): Promise<void> {
  await AsyncStorage.setItem(RATING_ASKED_KEY, answer).catch(() => {});
}

/** The Play listing, in the Play Store app if it will open, else the web. */
export async function openPlayListing(): Promise<void> {
  try {
    await Linking.openURL(PLAY_STORE_APP_URL);
  } catch {
    await Linking.openURL(PLAY_STORE_URL).catch(() => {});
  }
}
