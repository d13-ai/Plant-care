import { describe, expect, test } from "vitest";
import { bucketPrefix, proxiedPhotoUri } from "./photo-uri";

const PREFIX = bucketPrefix("https://abc.supabase.co", "plant-photos");

describe("where a photo is loaded from on the web", () => {
  test("a bucket photo comes through our own origin", () => {
    const stored = `${PREFIX}keeper/plant/photo.jpg`;
    expect(proxiedPhotoUri(stored, PREFIX)).toBe("/plant-photos/keeper/plant/photo.jpg");
  });

  test("a photo taken on this device is left alone", () => {
    for (const uri of ["file:///var/photos/a.jpg", "data:image/jpeg;base64,abc", "blob:https://x/y"]) {
      expect(proxiedPhotoUri(uri, PREFIX)).toBe(uri);
    }
  });

  test("some other https image is left alone", () => {
    const other = "https://example.com/storage/v1/object/public/plant-photos/x.jpg";
    expect(proxiedPhotoUri(other, PREFIX)).toBe(other);
  });

  test("without Supabase configured nothing is rewritten", () => {
    const empty = bucketPrefix("", "plant-photos");
    expect(empty).toBe("");
    expect(proxiedPhotoUri("file:///a.jpg", empty)).toBe("file:///a.jpg");
  });
});
