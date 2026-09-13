import { useColorScheme } from "react-native";

const light = {
  background: "#F6F7F4",
  card: "#FFFFFF",
  text: "#1B1F1A",
  muted: "#6B7069",
  border: "#E3E6E0",
  primary: "#2F6B3A",
  onPrimary: "#FFFFFF",
  critical: { fg: "#8E1F16", bg: "#FBE9E7" },
  warning: { fg: "#7A4E00", bg: "#FFF3D6" },
  attention: { fg: "#1F4F7A", bg: "#E4F0FA" },
  success: { fg: "#1E6B3A", bg: "#E3F3E8" },
  neutral: { fg: "#4A4F49", bg: "#EEF0EC" },
};

const dark: typeof light = {
  background: "#101311",
  card: "#1A1F1B",
  text: "#EEF1EC",
  muted: "#9BA39A",
  border: "#2A302B",
  primary: "#7BC48A",
  onPrimary: "#0F1A12",
  critical: { fg: "#F2A49B", bg: "#3A1B18" },
  warning: { fg: "#F0C15C", bg: "#3A2C0F" },
  attention: { fg: "#8FC3EE", bg: "#15293A" },
  success: { fg: "#8FD6A3", bg: "#173225" },
  neutral: { fg: "#C3C8C0", bg: "#252B26" },
};

export type Theme = typeof light;
export type Tone = "critical" | "warning" | "attention" | "success" | "neutral";

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
