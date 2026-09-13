import { Directory, File, Paths } from "expo-file-system";
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
  return persist(asset.uri);
}

function persist(uri: string): string {
  // The browser hands back a blob/data URL that is already durable enough
  // for a dev session; the File API is native-only.
  if (Platform.OS === "web") return uri;

  const dir = new Directory(Paths.document, "photos");
  if (!dir.exists) dir.create({ idempotent: true });
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const dest = new File(dir, name);
  new File(uri).copy(dest);
  return dest.uri;
}
