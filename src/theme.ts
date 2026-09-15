import { createContext, useContext } from "react";

/**
 * PlantParlour, round 3 of the brand work: an aubergine page with cream
 * cards, aubergine text on the cards, gold as the one working colour, plum
 * for the water drops and "Log", a cooler burgundy (never crimson) for
 * "something's up". Lora, the upright serif from the tag page, for titles
 * and section labels; Source Sans 3 for everything else.
 *
 * Text, chips and borders read differently on the page and inside a cream
 * card, so there are two palettes with one shape. `useTheme()` returns the
 * right one for wherever the component is rendered: Card sets the surface.
 * Every pair was measured against WCAG AA (4.5:1 text, 3:1 graphics).
 */
const brand = {
  aubergine: "#2E1633",
  cream: "#F3ECDD",
  creamBright: "#FBF7EE",
  plum: "#4B2142",
  forest: "#1F3D2B",
  gold: "#C9A24B",
  goldDeep: "#7A5A12",
  goldLight: "#E6C46B",
  leaf: "#8FC79E",
  hair: "rgba(201,162,75,0.6)",
  hair2: "rgba(201,162,75,0.35)",
};

export type Surface = "page" | "card";
type ToneColors = { fg: string; bg: string; ring: string };

export interface Theme {
  surface: Surface;
  background: string;
  card: string;
  input: string;
  inputBorder: string;
  text: string;
  muted: string;
  /** Small serif capitals above a section. */
  label: string;
  border: string;
  hairline: string;
  primary: string;
  onPrimary: string;
  plum: string;
  onPlum: string;
  gold: string;
  goldText: string;
  forest: string;
  leaf: string;
  drop: string;
  dropRing: string;
  dropFilledBg: string;
  dropFilled: string;
  critical: ToneColors;
  warning: ToneColors;
  attention: ToneColors;
  success: ToneColors;
  neutral: ToneColors;
}

const onPage: Theme = {
  surface: "page",
  background: brand.aubergine,
  card: brand.cream,
  input: "#3A2145",
  inputBorder: brand.hair,
  text: brand.cream,
  muted: "#C8B8C2",
  label: brand.gold,
  border: brand.hair,
  hairline: brand.hair2,
  primary: brand.gold,
  onPrimary: brand.aubergine,
  plum: brand.plum,
  onPlum: brand.cream,
  gold: brand.gold,
  goldText: brand.goldLight,
  forest: brand.forest,
  leaf: brand.leaf,
  drop: brand.gold,
  dropRing: "#6A4F72",
  dropFilledBg: brand.plum,
  dropFilled: brand.goldLight,
  critical: { fg: "#E08BA6", bg: "#4A1E2C", ring: "#BD4A69" },
  warning: { fg: "#E6C46B", bg: "#4A3A12", ring: "#C9A24B" },
  attention: { fg: "#B7C4EE", bg: "#2A2F4A", ring: "#B7C4EE" },
  success: { fg: "#A8D5B5", bg: "#1F3D2B", ring: "#8FC79E" },
  neutral: { fg: "#D9CBD6", bg: "#4A2F55", ring: "#4A2F55" },
};

const inCard: Theme = {
  surface: "card",
  background: brand.cream,
  card: brand.cream,
  input: brand.creamBright,
  inputBorder: brand.plum,
  text: brand.aubergine,
  muted: "#6B5A6B",
  label: brand.forest,
  border: brand.hair,
  hairline: brand.hair2,
  primary: brand.gold,
  onPrimary: brand.aubergine,
  plum: brand.plum,
  onPlum: brand.cream,
  gold: brand.gold,
  goldText: brand.goldDeep,
  forest: brand.forest,
  leaf: brand.leaf,
  drop: "#9C7A22",
  dropRing: brand.plum,
  dropFilledBg: brand.plum,
  dropFilled: brand.goldLight,
  critical: { fg: "#7A2141", bg: "#F0DCE2", ring: "#BD4A69" },
  warning: { fg: "#6E5212", bg: "#F6E9C6", ring: "#C9A24B" },
  attention: { fg: "#1F3F7A", bg: "#E4EAF6", ring: "#3C86C7" },
  success: { fg: "#1F3D2B", bg: "#E3EFE6", ring: "#8FC79E" },
  neutral: { fg: "#4B2142", bg: "#EDE3D3", ring: "#D9CBB4" },
};

export type Tone = "critical" | "warning" | "attention" | "success" | "neutral";

/** Which surface a component sits on. Card provides "card"; the page is the default. */
export const SurfaceContext = createContext<Surface>("page");

export function useTheme(): Theme {
  return useContext(SurfaceContext) === "card" ? inCard : onPage;
}

/** Loaded in the root layout. `regular/medium/bold` are the body face; `serif*` the display face. */
export const font = {
  regular: "SourceSans3_400Regular",
  medium: "SourceSans3_600SemiBold",
  bold: "SourceSans3_700Bold",
  serif: "Lora_600SemiBold",
  serifBold: "Lora_700Bold",
  serifItalic: "Lora_400Regular_Italic",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 6, md: 12, lg: 18 } as const;
