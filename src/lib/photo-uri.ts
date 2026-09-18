import { Platform } from "react-native";
import {
  bucketPrefix,
  proxiedPhotoUri,
  proxiedSizedUri,
  sizedPhotoUri,
  type PhotoSize,
} from "@/domain/photo-uri";
import { BUCKET, SUPABASE_URL } from "./supabase";

const PREFIX = bucketPrefix(SUPABASE_URL, BUCKET);

/**
 * The uri to actually render. On the web a bucket photo goes through the
 * app's own origin (see `src/domain/photo-uri.ts` for why); everywhere else
 * the stored uri is already right.
 *
 * This is applied when the photo is drawn rather than when it is pulled,
 * because `photos.uri` is written to the device database — the phones that
 * have already synced hold the direct bucket URL and would stay broken.
 */
export function displayPhotoUri(uri: string, size?: PhotoSize): string {
  if (!size) return Platform.OS === "web" ? proxiedPhotoUri(uri, PREFIX) : uri;
  return Platform.OS === "web"
    ? proxiedSizedUri(uri, PREFIX, size)
    : sizedPhotoUri(uri, PREFIX, size);
}
