import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, G, Line, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import { LogoMark } from "@/components/icons";
import { planLength, replayOnReturn, SKIP_FADE_MS, thresholdPlan, type ThresholdPlan } from "@/domain/threshold";
import { brand, font } from "@/theme";

/**
 * The opening sequence: a pair of parlour doors, aubergine and plum with
 * brass, swings open onto a lit room; "PlantParlour / Come in." comes up;
 * the room fades into the app. It plays every time the app is opened -- a
 * cold start, or coming back after a while away. When, and every timing, is
 * in src/domain/threshold.ts.
 *
 * It is a cover, not a gate. The root layout mounts it over everything else,
 * which loads and syncs underneath from the first frame; a tap anywhere skips
 * it; and if anything here stalls, a backstop takes it away regardless
 * (BACKSTOP_SLACK_MS) -- the app is never kept waiting by a door.
 *
 * All vector, drawn below: no images, no video, nothing to download.
 */

const native = Platform.OS !== "web";
/** How long past the end of the plan before the backstop takes the cover away; only reached if something here has stalled. */
const BACKSTOP_SLACK_MS = 1500;
/** The leaf mark above the wordmark. */
const LOGO_SIZE = 88;
/** The logo, wordmark, rule and "Come in." stacked: used to centre them on the lamp. */
const WORDS_HEIGHT = LOGO_SIZE + 8 + 62 + 25 + 26;
/** How far the doors swing, in degrees -- just short of edge-on. */
const SWING_DEG = 86;

/**
 * Phones always get it. On the web it is the app's threshold only when the
 * site is installed to a home screen, not when someone opens plantparlour.org
 * in a browser tab; `?threshold` in the address forces it for a look.
 */
function wantedOnWeb(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("threshold")) return true;
    const standalone = (window.navigator as { standalone?: boolean }).standalone === true;
    return standalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
  } catch {
    return false;
  }
}

export function Threshold() {
  const [on, setOn] = useState(native);
  const [plan, setPlan] = useState<ThresholdPlan | null>(null);
  const { width, height } = useWindowDimensions();

  // 0 = doors shut, 1 = open; words 0 → 1 as the wordmark comes up; veil 1 → 0 as the room fades out.
  const doors = useRef(new Animated.Value(0)).current;
  const words = useRef(new Animated.Value(0)).current;
  const veil = useRef(new Animated.Value(1)).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);
  const skipped = useRef(false);

  // One opening: doors shut again, then play whichever version suits.
  const open = useCallback(() => {
    skipped.current = false;
    running.current?.stop();
    doors.setValue(0);
    words.setValue(0);
    veil.setValue(1);
    setPlan(null);
    setOn(true);
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => setPlan(thresholdPlan({ reduceMotion })));
  }, [doors, words, veil]);

  // On launch, and again on coming back after a while away.
  useEffect(() => {
    if (!native && !wantedOnWeb()) return;
    open();
    let awaySince: number | null = null;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        awaySince = Date.now();
      } else if (state === "active" && awaySince !== null) {
        const away = Date.now() - awaySince;
        awaySince = null;
        if (replayOnReturn(away)) open();
      }
    });
    return () => sub.remove();
  }, [open]);

  // The backstop: never more than a moment past the plan, whatever happens.
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setOn(false), (plan ? planLength(plan) : 1500) + BACKSTOP_SLACK_MS);
    return () => clearTimeout(t);
  }, [on, plan]);

  // Play it.
  useEffect(() => {
    if (!plan || skipped.current) return;
    const steps: Animated.CompositeAnimation[] = [];
    if (plan.doorsSwing) {
      steps.push(
        Animated.timing(doors, {
          toValue: 1,
          delay: plan.doorsDelayMs,
          duration: plan.doorsMs,
          // A gentle ease-out: a steady start, settling as they come fully open.
          easing: Easing.bezier(0.3, 0.1, 0.25, 1),
          useNativeDriver: native,
        }),
      );
    }
    if (plan.wordmark) {
      steps.push(
        Animated.timing(words, {
          toValue: 1,
          delay: plan.wordmarkDelayMs,
          duration: plan.wordmarkMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: native,
        }),
      );
    }
    steps.push(
      Animated.timing(veil, {
        toValue: 0,
        delay: plan.fadeDelayMs,
        duration: plan.fadeMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: native,
      }),
    );
    const all = Animated.parallel(steps);
    running.current = all;
    all.start(() => {
      if (!skipped.current) setOn(false);
    });
    return () => all.stop();
  }, [plan, doors, words, veil]);

  const skip = () => {
    if (skipped.current) return;
    skipped.current = true;
    running.current?.stop();
    Animated.timing(veil, { toValue: 0, duration: SKIP_FADE_MS, useNativeDriver: native }).start(() => setOn(false));
  };

  if (!on) return null;

  const half = width / 2;
  // The lamp and the wordmark share one centre, a little above the middle of the screen.
  const centre = height * 0.44;
  // Each door turns on its outer edge: shift the pivot there, turn, shift back.
  // Left door (side 1) swings away to the left, right door (side -1) to the right.
  const swing = (side: 1 | -1) => ({
    backfaceVisibility: "hidden" as const,
    opacity: doors.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
    transform: [
      { perspective: 1400 },
      { translateX: (-side * half) / 2 },
      { rotateY: doors.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${side * SWING_DEG}deg`] }) },
      { translateX: (side * half) / 2 },
    ],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.cover, { opacity: veil }]} testID="threshold">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel="PlantParlour. Come in."
        accessibilityHint="Skips the opening"
      >
        <Glow width={width} height={height} cy={centre} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.words,
            { top: centre - WORDS_HEIGHT / 2 },
            { opacity: words, transform: [{ translateY: words.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
          ]}
        >
          {/* In the light gold, one colour: the logo's darker outline gold
              disappears against the green room. */}
          <LogoMark size={LOGO_SIZE} color={brand.goldLight} />
          <Text style={styles.wordmark}>PlantParlour</Text>
          <View style={styles.rule} />
          <Text style={styles.comeIn}>Come in.</Text>
        </Animated.View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.doorway]}>
          <Animated.View style={[{ width: half, height }, swing(1)]}>
            <Door w={half} h={height} />
          </Animated.View>
          <Animated.View style={[{ width: half, height }, swing(-1)]}>
            <Door w={half} h={height} mirror />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The room behind the doors, lit by one lamp: deep forest green walls going to
 * aubergine at the edges, and a low brass warmth that gathers at the centre,
 * right behind the wordmark, rather than a bright disc.
 */
function Glow({ width, height, cy }: { width: number; height: number; cy: number }) {
  // Sized in points, not percentages, so the light stays round on a tall screen.
  const room = Math.max(width, height) * 0.75;
  const lamp = width * 0.62;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="parlourRoom" gradientUnits="userSpaceOnUse" cx={width / 2} cy={cy} r={room} fx={width / 2} fy={cy}>
          <Stop offset="0" stopColor={brand.forest} />
          <Stop offset="0.3" stopColor={brand.forest} />
          <Stop offset="1" stopColor={brand.aubergine} />
        </RadialGradient>
        <RadialGradient id="parlourLamp" gradientUnits="userSpaceOnUse" cx={width / 2} cy={cy} r={lamp} fx={width / 2} fy={cy}>
          <Stop offset="0" stopColor={brand.goldLight} stopOpacity={0.34} />
          <Stop offset="0.3" stopColor={brand.gold} stopOpacity={0.16} />
          <Stop offset="0.65" stopColor={brand.gold} stopOpacity={0.04} />
          <Stop offset="1" stopColor={brand.gold} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#parlourRoom)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#parlourLamp)" />
    </Svg>
  );
}

/** Points for a polygon. */
const pts = (list: [number, number][]) => list.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * One door, drawn for the left; `mirror` flips it for the right so the pulls
 * meet in the middle. Plum and aubergine framed in brass, in the parlour's
 * two period styles at once: Art Deco geometry (stepped double arch, a
 * sunburst fanlight, a jewelled rail, nested diamonds and corner fans) holding
 * Art Nouveau growth (whiplash tendrils, leaves and a lily bud rising up the
 * upper panel).
 */
function Door({ w, h, mirror = false }: { w: number; h: number; mirror?: boolean }) {
  const gold = brand.gold;
  const light = brand.goldLight;
  const m = 12; // plum margin around the aubergine panel
  const x0 = m + 14;
  const x1 = w - m - 14;
  const pw = x1 - x0;
  const cx = (x0 + x1) / 2;
  const r = pw / 2; // the arch is a half circle across the panel
  const yT = m + 18;
  const fanY = yT + r; // where the arch meets its transom
  const yB = h * 0.55; // bottom of the upper panel
  const railTop = yB + 10;
  const railBottom = railTop + 18;
  const yL = railBottom + 10; // lower panel
  const yE = h - m - 16;
  const lowMid = (yL + yE) / 2;
  const tall = yB - fanY; // the Nouveau field below the fanlight

  // Deco sunburst: alternating long and short rays from a half sun.
  const rays = Array.from({ length: 15 }, (_, i) => {
    const a = Math.PI + (Math.PI * (i + 1)) / 16;
    const len = i % 2 === 0 ? r * 0.86 : r * 0.62;
    return { x1: cx + Math.cos(a) * r * 0.26, y1: fanY + Math.sin(a) * r * 0.26, x2: cx + Math.cos(a) * len, y2: fanY + Math.sin(a) * len };
  });

  // Nouveau whiplash tendrils, a pair each side, each ending in a curl.
  const tendrils: string[] = [];
  const leaves: string[] = [];
  for (const s of [1, -1]) {
    const base = yB - 10;
    tendrils.push(
      `M ${cx} ${base} C ${cx + s * pw * 0.46} ${base - tall * 0.12} ${cx - s * pw * 0.06} ${base - tall * 0.52} ${cx + s * pw * 0.3} ${base - tall * 0.74}` +
        ` C ${cx + s * pw * 0.44} ${base - tall * 0.84} ${cx + s * pw * 0.36} ${base - tall * 0.97} ${cx + s * pw * 0.26} ${base - tall * 0.9}` +
        ` C ${cx + s * pw * 0.2} ${base - tall * 0.86} ${cx + s * pw * 0.25} ${base - tall * 0.8} ${cx + s * pw * 0.3} ${base - tall * 0.83}`,
      `M ${cx} ${base - tall * 0.18} C ${cx + s * pw * 0.3} ${base - tall * 0.22} ${cx + s * pw * 0.4} ${base - tall * 0.36} ${cx + s * pw * 0.34} ${base - tall * 0.46}` +
        ` C ${cx + s * pw * 0.3} ${base - tall * 0.52} ${cx + s * pw * 0.22} ${base - tall * 0.48} ${cx + s * pw * 0.26} ${base - tall * 0.42}`,
    );
    // Long Nouveau leaves along the tendrils.
    for (const [fx, fy, len, tilt] of [
      [0.2, 0.3, 0.2, -0.5],
      [0.16, 0.6, 0.17, -0.8],
    ] as const) {
      const lx = cx + s * pw * fx;
      const ly = base - tall * fy;
      const l = pw * len;
      const ex = lx + s * l;
      const ey = ly + tilt * l * 0.6;
      leaves.push(
        `M ${lx} ${ly} Q ${lx + s * l * 0.45} ${ly - l * 0.42 + tilt * l * 0.3} ${ex} ${ey} Q ${lx + s * l * 0.55} ${ly + l * 0.12 + tilt * l * 0.3} ${lx} ${ly} Z`,
      );
    }
  }
  // The lily bud at the top of the stem.
  const budTop = fanY + 10;
  const bud = `M ${cx} ${budTop} C ${cx + 9} ${budTop + 12} ${cx + 7} ${budTop + 26} ${cx} ${budTop + 32} C ${cx - 7} ${budTop + 26} ${cx - 9} ${budTop + 12} ${cx} ${budTop} Z`;

  // Nested Deco diamonds in the lower panel.
  const diamond = (inset: number) =>
    pts([
      [cx, yL + inset],
      [x1 - inset, lowMid],
      [cx, yE - inset],
      [x0 + inset, lowMid],
    ]);
  // A quarter sunburst in each lower corner.
  const cornerFan = (x: number, y: number, sx: number, sy: number) => {
    const rr = Math.min(26, pw * 0.2);
    const lines = [0, 1, 2, 3, 4].map((k) => {
      const a = (Math.PI / 2) * (k / 4);
      return `M ${x} ${y} L ${x + sx * Math.cos(a) * rr} ${y + sy * Math.sin(a) * rr}`;
    });
    return `M ${x + sx * rr} ${y} A ${rr} ${rr} 0 0 ${sx * sy > 0 ? 1 : 0} ${x} ${y + sy * rr} ` + lines.join(" ");
  };
  // Jewels along the rail.
  const jewels: [number, number][] = [];
  for (let x = x0 + 8; x <= x1 - 8; x += 14) jewels.push([x, (railTop + railBottom) / 2]);

  // The pull: an elongated Deco escutcheon with a brass bar, near the meeting edge.
  const hx = w - m - 9;
  const midY = h / 2;

  return (
    <Svg width={w} height={h}>
      <G transform={mirror ? `translate(${w} 0) scale(-1 1)` : undefined}>
        <Rect x={0} y={0} width={w} height={h} fill={brand.plum} />
        {/* Brass frame: a strong outer line, the panel line, and a hairline inside it. */}
        <Rect x={1} y={1} width={w - 2} height={h - 2} fill="none" stroke={gold} strokeWidth={2} />
        <Rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} rx={2} fill={brand.aubergine} stroke={gold} strokeWidth={1.5} />
        <Rect x={m + 5} y={m + 5} width={w - 2 * m - 10} height={h - 2 * m - 10} rx={1} fill="none" stroke={gold} strokeOpacity={0.45} strokeWidth={0.8} />
        {/* The brass astragal where the two doors meet. */}
        <Rect x={w - 3} y={0} width={3} height={h} fill={gold} />

        {/* Upper panel: stepped double arch over a sunburst fanlight. */}
        <Path d={`M ${x0} ${yB} L ${x0} ${fanY} A ${r} ${r} 0 0 1 ${x1} ${fanY} L ${x1} ${yB} Z`} fill="none" stroke={gold} strokeWidth={1.4} />
        <Path
          d={`M ${x0 + 5} ${yB - 5} L ${x0 + 5} ${fanY} A ${r - 5} ${r - 5} 0 0 1 ${x1 - 5} ${fanY} L ${x1 - 5} ${yB - 5} Z`}
          fill="none"
          stroke={gold}
          strokeOpacity={0.55}
          strokeWidth={0.9}
        />
        <G stroke={gold} strokeOpacity={0.8} strokeWidth={1} strokeLinecap="round">
          {rays.map((p, i) => (
            <Line key={`ray${i}`} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
          ))}
        </G>
        <Path d={`M ${cx - r * 0.22} ${fanY} A ${r * 0.22} ${r * 0.22} 0 0 1 ${cx + r * 0.22} ${fanY} Z`} fill={gold} fillOpacity={0.55} stroke={gold} strokeWidth={1} />
        <Line x1={x0} y1={fanY} x2={x1} y2={fanY} stroke={gold} strokeWidth={1.4} />
        <Line x1={x0} y1={fanY + 4} x2={x1} y2={fanY + 4} stroke={gold} strokeOpacity={0.5} strokeWidth={0.8} />

        {/* Nouveau growth up the panel. */}
        <Path d={`M ${cx} ${yB - 10} C ${cx + pw * 0.06} ${yB - tall * 0.4} ${cx - pw * 0.06} ${yB - tall * 0.65} ${cx} ${budTop + 30}`} fill="none" stroke={gold} strokeOpacity={0.75} strokeWidth={1.2} />
        <G fill="none" stroke={gold} strokeOpacity={0.7} strokeWidth={1.1} strokeLinecap="round">
          {tendrils.map((d, i) => (
            <Path key={`t${i}`} d={d} />
          ))}
        </G>
        <G fill={gold} fillOpacity={0.28} stroke={gold} strokeOpacity={0.75} strokeWidth={0.9}>
          {leaves.map((d, i) => (
            <Path key={`l${i}`} d={d} />
          ))}
          <Path d={bud} fill={light} fillOpacity={0.45} />
        </G>

        {/* The rail between the panels, set with brass jewels. */}
        <Line x1={x0} y1={railTop} x2={x1} y2={railTop} stroke={gold} strokeWidth={1.2} />
        <Line x1={x0} y1={railBottom} x2={x1} y2={railBottom} stroke={gold} strokeWidth={1.2} />
        <G fill={gold}>
          {jewels.map(([x, y], i) => (
            <Polygon key={`j${i}`} points={pts([[x, y - 4], [x + 4, y], [x, y + 4], [x - 4, y]])} />
          ))}
        </G>

        {/* Lower panel: nested diamonds and corner fans. */}
        <Rect x={x0} y={yL} width={pw} height={yE - yL} fill="none" stroke={gold} strokeWidth={1.4} />
        <Rect x={x0 + 5} y={yL + 5} width={pw - 10} height={yE - yL - 10} fill="none" stroke={gold} strokeOpacity={0.5} strokeWidth={0.8} />
        <G fill="none" stroke={gold} strokeLinejoin="round">
          <Polygon points={diamond(12)} strokeOpacity={0.75} strokeWidth={1.1} />
          <Polygon points={diamond(26)} strokeOpacity={0.55} strokeWidth={0.9} />
          <Polygon points={diamond(40)} strokeOpacity={0.4} strokeWidth={0.8} />
          <Path d={`M ${cx} ${yL + 12} L ${cx} ${yE - 12} M ${x0 + 12} ${lowMid} L ${x1 - 12} ${lowMid}`} strokeOpacity={0.25} strokeWidth={0.8} />
          <Path d={cornerFan(x0 + 5, yL + 5, 1, 1)} strokeOpacity={0.6} strokeWidth={0.9} />
          <Path d={cornerFan(x1 - 5, yL + 5, -1, 1)} strokeOpacity={0.6} strokeWidth={0.9} />
          <Path d={cornerFan(x0 + 5, yE - 5, 1, -1)} strokeOpacity={0.6} strokeWidth={0.9} />
          <Path d={cornerFan(x1 - 5, yE - 5, -1, -1)} strokeOpacity={0.6} strokeWidth={0.9} />
        </G>
        <Polygon points={pts([[cx, lowMid - 7], [cx + 7, lowMid], [cx, lowMid + 7], [cx - 7, lowMid]])} fill={gold} />

        {/* The pull. */}
        <Polygon
          points={pts([
            [hx, midY - 64],
            [hx + 8, midY - 50],
            [hx + 8, midY + 50],
            [hx, midY + 64],
            [hx - 8, midY + 50],
            [hx - 8, midY - 50],
          ])}
          fill={brand.plum}
          stroke={gold}
          strokeWidth={1.4}
        />
        <Rect x={hx - 2.5} y={midY - 38} width={5} height={60} rx={2.5} fill={light} />
        <Circle cx={hx} cy={midY + 36} r={2.6} fill={gold} />
        <Polygon points={pts([[hx - 1.6, midY + 37], [hx + 1.6, midY + 37], [hx, midY + 44]])} fill={gold} />
        <Polygon points={pts([[hx, midY - 72], [hx + 3, midY - 68], [hx, midY - 64], [hx - 3, midY - 68]])} fill={gold} />
        <Polygon points={pts([[hx, midY + 64], [hx + 3, midY + 68], [hx, midY + 72], [hx - 3, midY + 68]])} fill={gold} />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  cover: { zIndex: 1000, elevation: 1000, backgroundColor: brand.aubergine },
  doorway: { flexDirection: "row" },
  words: { position: "absolute", left: 0, right: 0, height: WORDS_HEIGHT, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  wordmark: { fontFamily: font.serifItalic, fontSize: 50, lineHeight: 62, color: brand.cream, letterSpacing: 0.3, marginTop: 8 },
  rule: { width: 52, height: 1, backgroundColor: brand.gold, marginTop: 12, marginBottom: 12 },
  comeIn: { fontFamily: font.serif, fontSize: 19, lineHeight: 26, color: brand.goldLight, letterSpacing: 0.8 },
});
