/**
 * Where a stored photo is loaded from in the browser.
 *
 * Photos live in a Supabase Storage bucket, a different origin from the app.
 * The web build sets `Cross-Origin-Embedder-Policy: require-corp`, because
 * expo-sqlite's wasm needs cross-origin isolation — and under that policy a
 * plain `<img>` may only load a cross-origin image whose response carries
 * `Cross-Origin-Resource-Policy`. Supabase Storage does not send one, so every
 * photo loaded by URL was blocked.
 *
 * It hid for a long time because a keeper's own photos are local files on the
 * device that took them; only a *second* device, which pulled the rows and has
 * nothing but URLs, ever loads them this way. The first person to sign in on a
 * second phone saw a greenhouse with no pictures in it.
 *
 * Vercel rewrites `/plant-photos/<path>` to the bucket, so the same bytes
 * arrive same-origin, where the policy doesn't apply. Only bucket URLs are
 * rewritten: local `file:` and `data:` URIs are left alone.
 */
export const PHOTO_PROXY_PREFIX = "/plant-photos/";

/** The public bucket URL a photo's `uri` is stored as. */
export function bucketPrefix(supabaseUrl: string, bucket: string): string {
  return supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${bucket}/` : "";
}

export function proxiedPhotoUri(uri: string, prefix: string): string {
  if (!prefix || !uri.startsWith(prefix)) return uri;
  return PHOTO_PROXY_PREFIX + uri.slice(prefix.length);
}
