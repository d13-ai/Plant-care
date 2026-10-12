import { Platform } from "react-native";
import {
  bucketPrefix,
  photoSources,
  proxiedPhotoSources,
  proxiedPhotoUri,
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
  return displayPhotoSources(uri, size)[0];
}

/**
 * Every uri to try for a photo, best first -- the copy saved beside it at
 * upload, then the bucket resizing it on the way out (see "Copies saved at
 * upload" in `src/domain/photo-uri.ts`). `BucketImage` walks the list.
 */
export function displayPhotoSources(uri: string, size?: PhotoSize): string[] {
  if (!size) return [Platform.OS === "web" ? proxiedPhotoUri(uri, PREFIX) : uri];
  return Platform.OS === "web" ? proxiedPhotoSources(uri, PREFIX, size) : photoSources(uri, PREFIX, size);
}
