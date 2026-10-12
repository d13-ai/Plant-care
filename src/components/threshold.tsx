import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { SKIP_FADE_MS, thresholdPlan, type ThresholdPlan } from "@/domain/threshold";
import { brand, font } from "@/theme";

/**
 * The opening sequence: a pair of parlour doors, aubergine and plum with
 * brass, swings open onto a lit room; "PlantParlour / Come in." comes up;
 * the room fades into the app. Which version plays and every timing are in
 * src/domain/threshold.ts.
 *
 * It is a cover, not a gate. The root layout mounts it over everything else,
 * which loads and syncs underneath from the first frame; a tap anywhere skips
 * it; and if anything here stalls, a backstop takes it away regardless
 * (BACKSTOP_MS) -- the app is never kept waiting by a door.
 *
 * All vector, drawn below: no images, no video, nothing to download.
 */

const SEEN_KEY = "thresholdSeen";
const native = Platform.OS !== "web";
/** Longer than the longest plan; only reached if something here has stalled. */
const BACKSTOP_MS = 4000;
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

  // Which version, and remember that this one has been seen.
  useEffect(() => {
    if (!native && !wantedOnWeb()) return;
    setOn(true);
    let live = true;
    const backstop = setTimeout(() => setOn(false), BACKSTOP_MS);
    Promise.all([
      AsyncStorage.getItem(SEEN_KEY)
        .then((v) => v !== null)
        .catch(() => false),
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
    ]).then(([seenBefore, reduceMotion]) => {
      if (!live) return;
      AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
      setPlan(thresholdPlan({ seenBefore, reduceMotion }));
    });
    return () => {
      live = false;
      clearTimeout(backstop);
    };
  }, []);

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
        <Glow width={width} height={height} />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.words,
            { opacity: words, transform: [{ translateY: words.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
          ]}
        >
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

/** The room behind the doors: warm cream at the centre, deepening to forest green, then the aubergine of the walls. */
function Glow({ width, height }: { width: number; height: number }) {
  // Sized in points, not percentages, so the light is round on a tall screen.
  const cy = height * 0.46;
  const r = Math.max(width, height) * 0.62;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="parlourGlow" gradientUnits="userSpaceOnUse" cx={width / 2} cy={cy} r={r} fx={width / 2} fy={cy}>
          <Stop offset="0" stopColor={brand.cream} />
          <Stop offset="0.36" stopColor={brand.cream} stopOpacity={0.95} />
          <Stop offset="0.74" stopColor={brand.forest} />
          <Stop offset="1" stopColor={brand.aubergine} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#parlourGlow)" />
    </Svg>
  );
}

/**
 * One door, drawn for the left; `mirror` flips it for the right so the
 * handles meet in the middle. Plum with an aubergine panel, a thin brass
 * border, an arched upper panel of conservatory ironwork in faint brass line,
 * a lattice below, and a brass pull at the meeting edge.
 */
function Door({ w, h, mirror = false }: { w: number; h: number; mirror?: boolean }) {
  const m = 12; // plum margin around the aubergine panel
  const x0 = m + 12;
  const x1 = w - m - 12;
  const pw = x1 - x0;
  const r = pw / 2; // the arch is a half circle across the panel
  const yT = m + 14;
  const yB = h * 0.54;
  const ph = yB - yT;
  const cx = (x0 + x1) / 2;
  const lowTop = h * 0.6;
  const lowBottom = h - m - 14;

  // Ironwork scrolls up the stem: each curls outward and back, with a leaf.
  const scrolls: string[] = [];
  const leaves: string[] = [];
  for (const f of [0.86, 0.68, 0.5]) {
    const y = yT + ph * f;
    for (const s of [1, -1]) {
      scrolls.push(
        `M ${cx} ${y} C ${cx + s * pw * 0.18} ${y - ph * 0.06} ${cx + s * pw * 0.38} ${y - ph * 0.01} ${cx + s * pw * 0.36} ${y + ph * 0.05}` +
          ` C ${cx + s * pw * 0.34} ${y + ph * 0.09} ${cx + s * pw * 0.25} ${y + ph * 0.08} ${cx + s * pw * 0.26} ${y + ph * 0.045}`,
      );
      const lx = cx + s * pw * 0.12;
      const ly = y - ph * 0.045;
      const l = pw * 0.13;
      leaves.push(`M ${lx} ${ly} Q ${lx + s * l * 0.5} ${ly - l * 0.45} ${lx + s * l} ${ly - l * 0.2} Q ${lx + s * l * 0.5} ${ly + l * 0.15} ${lx} ${ly}`);
    }
  }
  // A fanlight under the arch.
  const fanY = yT + r;
  const rays = [200, 223, 246, 270, 294, 317, 340].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { x2: cx + Math.cos(a) * r * 0.82, y2: fanY + Math.sin(a) * r * 0.82 };
  });

  const handleX = w - m - 6;
  const midY = h / 2;

  return (
    <Svg width={w} height={h}>
      <G transform={mirror ? `translate(${w} 0) scale(-1 1)` : undefined}>
        <Rect x={0} y={0} width={w} height={h} fill={brand.plum} />
        <Rect x={0.75} y={0.75} width={w - 1.5} height={h - 1.5} fill="none" stroke={brand.gold} strokeWidth={1.5} />
        <Rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} rx={2} fill={brand.aubergine} stroke={brand.gold} strokeOpacity={0.55} strokeWidth={1} />

        {/* Upper arched panel and its ironwork. */}
        <Path
          d={`M ${x0} ${yB} L ${x0} ${yT + r} A ${r} ${r} 0 0 1 ${x1} ${yT + r} L ${x1} ${yB} Z`}
          fill="none"
          stroke={brand.gold}
          strokeOpacity={0.7}
          strokeWidth={1}
        />
        <G stroke={brand.gold} strokeOpacity={0.24} strokeWidth={1.1} strokeLinecap="round" fill="none">
          <Path d={`M ${cx} ${yB - 4} L ${cx} ${fanY + r * 0.1}`} />
          {scrolls.map((d, i) => (
            <Path key={`s${i}`} d={d} />
          ))}
          {leaves.map((d, i) => (
            <Path key={`l${i}`} d={d} />
          ))}
          {rays.map((p, i) => (
            <Line key={`r${i}`} x1={cx} y1={fanY} x2={p.x2} y2={p.y2} />
          ))}
          <Path d={`M ${cx - r * 0.36} ${fanY} A ${r * 0.36} ${r * 0.36} 0 0 1 ${cx + r * 0.36} ${fanY}`} />
          <Line x1={x0} y1={fanY} x2={x1} y2={fanY} />
        </G>

        {/* Lower panel with a conservatory lattice. */}
        <Rect x={x0} y={lowTop} width={pw} height={lowBottom - lowTop} fill="none" stroke={brand.gold} strokeOpacity={0.5} strokeWidth={1} />
        <G stroke={brand.gold} strokeOpacity={0.18} strokeWidth={1} fill="none">
          <Path d={`M ${x0} ${lowTop} L ${x1} ${lowBottom} M ${x1} ${lowTop} L ${x0} ${lowBottom}`} />
          <Path
            d={`M ${cx} ${lowTop + 10} L ${x1 - 10} ${(lowTop + lowBottom) / 2} L ${cx} ${lowBottom - 10} L ${x0 + 10} ${(lowTop + lowBottom) / 2} Z`}
          />
        </G>

        {/* The brass pull, at the edge where the doors meet. */}
        <Rect x={handleX - 7} y={midY - 46} width={14} height={92} rx={7} fill="none" stroke={brand.gold} strokeOpacity={0.85} strokeWidth={1.25} />
        <Rect x={handleX - 3} y={midY - 32} width={6} height={64} rx={3} fill={brand.gold} />
        <Circle cx={handleX} cy={midY + 58} r={2.5} fill={brand.gold} fillOpacity={0.85} />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  cover: { zIndex: 1000, elevation: 1000, backgroundColor: brand.aubergine },
  doorway: { flexDirection: "row" },
  words: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  wordmark: { fontFamily: font.serifItalic, fontSize: 42, color: brand.aubergine, letterSpacing: 0.3 },
  rule: { width: 44, height: 1, backgroundColor: brand.gold, marginVertical: 12 },
  comeIn: { fontFamily: font.serif, fontSize: 18, color: brand.forest, letterSpacing: 0.6 },
});
