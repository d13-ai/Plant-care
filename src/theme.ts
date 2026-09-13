import { useColorScheme } from "react-native";

/**
 * Direction B ("Signal"): a light, warm-green ground with one deep green as
 * the working color, status told in small square-cornered chips, and the
 * water-due rings on the home screen. Space Grotesk throughout.
 */
const light = {
  background: "#F3F6F1",
  card: "#FFFFFF",
  text: "#14201A",
  muted: "#6E7D72",
  border: "#E2E8DF",
  primary: "#1F6B3A",
  onPrimary: "#FFFFFF",
  critical: { fg: "#8E1F16", bg: "#FBE9E7", ring: "#C8341F" },
  warning: { fg: "#7A4E00", bg: "#FFF3D6", ring: "#E0A526" },
  attention: { fg: "#1F4F7A", bg: "#E4F0FA", ring: "#3C86C7" },
  success: { fg: "#1E6B3A", bg: "#E3F3E8", ring: "#1F6B3A" },
  neutral: { fg: "#4A4F49", bg: "#EAEFE8", ring: "#CFD9CC" },
};

const dark: typeof light = {
  background: "#0F1613",
  card: "#17201B",
  text: "#EEF3EA",
  muted: "#93A398",
  border: "#26302A",
  primary: "#8FD6A3",
  onPrimary: "#0F1A12",
  critical: { fg: "#F2A49B", bg: "#3A1B18", ring: "#F2A49B" },
  warning: { fg: "#F0C15C", bg: "#3A2C0F", ring: "#F0C15C" },
  attention: { fg: "#8FC3EE", bg: "#15293A", ring: "#8FC3EE" },
  success: { fg: "#8FD6A3", bg: "#173225", ring: "#8FD6A3" },
  neutral: { fg: "#C3C8C0", bg: "#252B26", ring: "#3A453D" },
};

export type Theme = typeof light;
export type Tone = "critical" | "warning" | "attention" | "success" | "neutral";

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

/** Space Grotesk, loaded in the root layout. Weight is chosen by family on native. */
export const font = {
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  bold: "SpaceGrotesk_700Bold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 6, md: 12, lg: 18 } as const;
