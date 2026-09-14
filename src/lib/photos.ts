import { Directory, File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export type PhotoSource = "camera" | "library";

/**
 * Take or choose a photo and return a URI the app owns. Picker results live
 * in a cache the OS may clear, so the file is copied into the app's document
 * directory before the URI is stored in the database.
 */
export async function capturePhoto(source: PhotoSource): Promise<string | null> {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return null;
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: false,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return persist(asset.uri, asset.width);
}

/** Longest edge kept for web photos — plenty for a phone screen and the
 *  AI check (which shrinks to 1024 anyway), small enough to live in SQLite. */
const WEB_MAX_WIDTH = 1600;

async function persist(uri: string, width: number): Promise<string> {
  if (Platform.OS === "web") {
    // The browser's picker returns a blob: URL that only lives as long as
    // the page that created it — store it and the photo is gone on the next
    // load. Re-encode to a self-contained data: URL that the database keeps.
    const actions = width > WEB_MAX_WIDTH ? [{ resize: { width: WEB_MAX_WIDTH } }] : [];
    const shrunk = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
    if (!shrunk.base64) throw new Error("Couldn't read the photo.");
    return `data:image/jpeg;base64,${shrunk.base64}`;
  }

  // Picker results live in a cache the OS may clear; copy into the app's
  // own document directory before the URI is stored.
  const dir = new Directory(Paths.document, "photos");
  if (!dir.exists) dir.create({ idempotent: true });
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const dest = new File(dir, name);
  new File(uri).copy(dest);
  return dest.uri;
}
