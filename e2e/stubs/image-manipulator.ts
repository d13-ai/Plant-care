/**
 * Stand-in for `expo-image-manipulator`, which needs a phone or a browser.
 * It hands the image back unchanged, so the sync still uploads the saved
 * copies (`src/lib/photo-sizes.ts`) and the test can see them land and go --
 * what they look like is a device's concern, not the round trip's.
 */
export const SaveFormat = { JPEG: "jpeg", PNG: "png", WEBP: "webp" } as const;

export async function manipulateAsync(uri: string): Promise<{ uri: string; width: number; height: number }> {
  return { uri, width: 320, height: 320 };
}
