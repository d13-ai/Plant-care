import * as ImageManipulator from "expo-image-manipulator";
/**
 * The two smaller copies uploaded beside every photo, made here on the phone
 * where it costs nothing (see "Copies saved at upload" in
 * `src/domain/photo-uri.ts`): a 900px-wide view in the photo's own shape, and
 * a 320px square cut from its centre. The view is made first because the
 * manipulator reports the size it actually produced, rotation applied, and
 * the square is cut from that rather than from the original's metadata.
 */
export async function savedSizes(uri: string): Promise<{ view: string; thumb: string }> {
  const view = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 900 } }], {
    compress: 0.75,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const scale = 320 / Math.min(view.width, view.height);
  const w = Math.max(320, Math.round(view.width * scale));
  const h = Math.max(320, Math.round(view.height * scale));
  const thumb = await ImageManipulator.manipulateAsync(
    view.uri,
    [
      { resize: { width: w, height: h } },
      { crop: { originX: Math.floor((w - 320) / 2), originY: Math.floor((h - 320) / 2), width: 320, height: 320 } },
    ],
    { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { view: view.uri, thumb: thumb.uri };
}
