import { describe, expect, test } from "vitest";
import {
  bucketPrefix,
  PHOTO_SIZES,
  proxiedPhotoUri,
  proxiedSizedUri,
  sizedPhotoUri,
} from "./photo-uri";

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

describe("asking the bucket for the size we actually draw", () => {
  const stored = `${PREFIX}keeper/plant/photo.jpg`;

  test("a bucket photo is fetched through the render endpoint, at the size given", () => {
    const url = new URL(sizedPhotoUri(stored, PREFIX, PHOTO_SIZES.thumb));
    expect(url.pathname).toBe("/storage/v1/render/image/public/plant-photos/keeper/plant/photo.jpg");
    expect(url.searchParams.get("width")).toBe("320");
    expect(url.searchParams.get("height")).toBe("320");
    expect(url.searchParams.get("resize")).toBe("cover");
    expect(url.searchParams.get("quality")).toBe("65");
  });

  test("the full size keeps the photo's shape rather than cropping it", () => {
    const url = new URL(sizedPhotoUri(stored, PREFIX, PHOTO_SIZES.full));
    expect(url.searchParams.get("resize")).toBe("contain");
    expect(url.searchParams.has("height")).toBe(false);
  });

  test("on the web it goes through our own origin, still sized", () => {
    const uri = proxiedSizedUri(stored, PREFIX, PHOTO_SIZES.card);
    expect(uri.startsWith("/plant-thumb/keeper/plant/photo.jpg?")).toBe(true);
    expect(new URL(uri, "https://x").searchParams.get("width")).toBe("640");
  });

  test("a photo on this device has no server to ask, and is left alone", () => {
    for (const uri of ["file:///var/photos/a.jpg", "data:image/jpeg;base64,abc", "blob:https://x/y"]) {
      expect(sizedPhotoUri(uri, PREFIX, PHOTO_SIZES.thumb)).toBe(uri);
      expect(proxiedSizedUri(uri, PREFIX, PHOTO_SIZES.thumb)).toBe(uri);
    }
  });

  test("somebody else's https image is left alone", () => {
    const other = "https://example.com/storage/v1/object/public/plant-photos/x.jpg";
    expect(sizedPhotoUri(other, PREFIX, PHOTO_SIZES.thumb)).toBe(other);
  });

  test("every named size is smaller than the 1600px original we store", () => {
    for (const [name, size] of Object.entries(PHOTO_SIZES)) {
      expect(size.w, name).toBeLessThan(1600);
      expect(size.q ?? 70, name).toBeLessThanOrEqual(80);
    }
  });
});
