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

/* ---- asking the bucket for a smaller copy ----------------------------- */

/**
 * Supabase can resize on the way out, and the difference is not small. One
 * real photo from the bucket, 1600×3463 and 704 KB, measured through the
 * render endpoint:
 *
 *     320×320 cover  q65 ->  10 KB   (69x smaller)
 *     640×640 cover  q72 ->  33 KB   (21x)
 *     900 wide contain q75 -> 144 KB  (4.9x)
 *
 * A grid of forty plants was 28 MB of originals to show forty thumbnails the
 * size of a postage stamp. It is the page weight a keeper on a phone pays
 * for, and the egress the project pays for, so the size asked for should
 * match the size drawn.
 *
 * Only bucket URLs are rewritten. A photo taken on this device is a `file:`
 * or `data:` URI with no server to ask, and is returned untouched.
 */
export type PhotoSize = {
  /** Width in CSS pixels of the box it is drawn in. */
  w: number;
  /** Height, for a fixed box. Omitted means the image keeps its shape. */
  h?: number;
  /** `cover` crops to fill a fixed box; `contain` fits inside it. */
  fit?: "cover" | "contain";
  /** JPEG quality, 20–100. Smaller boxes can take a lower number. */
  q?: number;
};

/** The sizes this app actually draws, named so they stay consistent. */
export const PHOTO_SIZES = {
  /** A row thumbnail or a due-ring avatar. */
  thumb: { w: 320, h: 320, fit: "cover", q: 65 } as PhotoSize,
  /** A card's cover photo, and the hero on a tag page. */
  card: { w: 640, h: 640, fit: "cover", q: 72 } as PhotoSize,
  /** Opened full width on a phone, where its shape matters. */
  full: { w: 900, fit: "contain", q: 75 } as PhotoSize,
} as const;

const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";

export function sizeQuery(size: PhotoSize): string {
  const p = new URLSearchParams({ width: String(size.w) });
  if (size.h) p.set("height", String(size.h));
  if (size.fit) p.set("resize", size.fit);
  p.set("quality", String(size.q ?? 70));
  return p.toString();
}

/**
 * The bucket URL for a photo at the size it will be drawn. Anything that is
 * not a photo in this bucket — a local file, a data URI, somebody else's
 * https image — comes back exactly as it went in.
 */
export function sizedPhotoUri(uri: string, prefix: string, size: PhotoSize): string {
  if (!prefix || !uri.startsWith(prefix)) return uri;
  return uri.replace(OBJECT_PATH, RENDER_PATH) + "?" + sizeQuery(size);
}

/**
 * The same thing for the web build, which cannot load the bucket directly —
 * see the note at the top of this file. `/plant-thumb/` is the rewrite that
 * reaches the render endpoint, as `/plant-photos/` reaches the raw object.
 */
export const THUMB_PROXY_PREFIX = "/plant-thumb/";

export function proxiedSizedUri(uri: string, prefix: string, size: PhotoSize): string {
  if (!prefix || !uri.startsWith(prefix)) return uri;
  return THUMB_PROXY_PREFIX + uri.slice(prefix.length) + "?" + sizeQuery(size);
}
