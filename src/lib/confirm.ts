import { Alert, Platform } from "react-native";

/**
 * "Are you sure?" that works everywhere. React Native's Alert is a no-op on
 * the web, so a destructive button there would do nothing — this uses the
 * browser's own confirm dialog instead. Resolves true when the keeper
 * confirms.
 */
export function confirm(
  title: string,
  message: string,
  options: { confirmText?: string; destructive?: boolean } = {},
): Promise<boolean> {
  const confirmText = options.confirmText ?? "OK";
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirmText, style: options.destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]);
  });
}
