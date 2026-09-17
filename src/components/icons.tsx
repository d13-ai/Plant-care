import Svg, { Circle, Defs, Mask, Path } from "react-native-svg";

import monstera from "@/brand/monstera.json";

type IconProps = { size?: number; color: string; strokeWidth?: number };

export function DropIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5c3.5 4.5 7 8 7 12a7 7 0 0 1-14 0c0-4 3.5-7.5 7-12z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlusIcon({ size = 18, color, strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function TagIcon({ size = 12, color, strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 12l-8 8-9-9V3h8l9 9z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="7.5" cy="7.5" r="1.5" fill={color} />
    </Svg>
  );
}

/** iOS's share glyph — the button people need to find to install the app. */
export function ShareIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 10H16"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PersonIcon({ size = 20, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M4 20.5c0-3.6 3.6-6 8-6s8 2.4 8 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Google's "G", for the sign-in button. */
export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

export function CloseIcon({ size = 14, color, strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * PLACEHOLDER MARK — a monstera leaf, standing in until Amanda's logo lands.
 * The geometry lives in `src/brand/monstera.json` so the app, the PNG assets
 * (`npm run icons`) and the public pages all draw the same shape. Swap that
 * file for the real logo and rerun `npm run icons`.
 */
export function MonsteraIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={monstera.viewBox} fill="none">
      <Defs>
        {/* White keeps the blade; black cuts the lobes and the basal notch clean through. */}
        <Mask id="pp-monstera">
          <Path d={monstera.blade} fill="#fff" />
          {monstera.splits.map((d) => (
            <Path
              key={d}
              d={d}
              stroke="#000"
              strokeWidth={monstera.splitWidth}
              strokeLinecap="round"
            />
          ))}
          <Path
            d={monstera.notch}
            stroke="#000"
            strokeWidth={monstera.notchWidth}
            strokeLinecap="round"
          />
        </Mask>
      </Defs>
      <Path
        d={monstera.petiole}
        stroke={color}
        strokeWidth={monstera.petioleWidth}
        strokeLinecap="round"
      />
      <Path d={monstera.blade} fill={color} mask="url(#pp-monstera)" />
    </Svg>
  );
}

/**
 * The Parlour Games mark — a pipe run with the water half of it filled, the
 * same shape the hub page draws in SVG. The link and the place it goes are
 * meant to be recognisably the same thing.
 */
export function PipesIcon({
  size = 20,
  dry,
  wet,
  node,
}: {
  size?: number;
  dry: string;
  wet: string;
  node: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M18 18H50" stroke={dry} strokeWidth={14} strokeLinecap="round" />
      <Path d="M50 18V50H82" stroke={wet} strokeWidth={14} strokeLinecap="round" />
      <Path d="M50 50V82" stroke={wet} strokeWidth={14} strokeLinecap="round" />
      <Circle cx={50} cy={50} r={11} fill={node} />
    </Svg>
  );
}
