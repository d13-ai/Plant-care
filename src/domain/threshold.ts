/**
 * The opening sequence: the parlour doors swing open onto a lit room, the
 * wordmark comes up with "Come in.", and the room fades into the app. A
 * threshold, not a loading screen -- the app loads underneath the whole time,
 * so nothing here ever waits on data.
 *
 * Which version plays, and its timings, live here so they can be tuned in one
 * place and held to the brief by threshold.test.ts:
 *
 *  - first launch: the full sequence, under 3 seconds;
 *  - every launch after: the doors alone, about a second;
 *  - "reduce motion" on: no doors swinging, only a fade.
 *
 * A tap anywhere skips it (SKIP_FADE_MS). src/components/threshold.tsx draws it.
 */
export type ThresholdKind = "full" | "short" | "fade";

export interface ThresholdPlan {
  kind: ThresholdKind;
  /** Whether the doors swing; with reduce motion they stay shut and the whole cover fades. */
  doorsSwing: boolean;
  doorsDelayMs: number;
  doorsMs: number;
  /** Whether "PlantParlour / Come in." comes up behind the doors. */
  wordmark: boolean;
  wordmarkDelayMs: number;
  wordmarkMs: number;
  /** When the room starts fading into the app, and over how long. */
  fadeDelayMs: number;
  fadeMs: number;
}

/**
 * Every number in the sequence. Change timings here.
 *
 * Full: a beat on the closed doors, 1.2 s of opening, the wordmark rising as
 * they clear it, half a second's hold, then the fade -- 2.55 s in all.
 */
export const TIMING = {
  full: {
    doorsDelayMs: 150,
    doorsMs: 1200,
    wordmarkDelayMs: 1000,
    wordmarkMs: 500,
    // wordmark fully in at 1500; held for 500
    fadeDelayMs: 2000,
    fadeMs: 550,
  },
  short: {
    doorsDelayMs: 0,
    doorsMs: 700,
    fadeDelayMs: 600,
    fadeMs: 350,
  },
  fade: {
    fadeDelayMs: 250,
    fadeMs: 450,
  },
} as const;

/** How long a tap-to-skip takes to clear the doors away. */
export const SKIP_FADE_MS = 200;

export function thresholdPlan({ seenBefore, reduceMotion }: { seenBefore: boolean; reduceMotion: boolean }): ThresholdPlan {
  if (reduceMotion) {
    return {
      kind: "fade",
      doorsSwing: false,
      doorsDelayMs: 0,
      doorsMs: 0,
      wordmark: false,
      wordmarkDelayMs: 0,
      wordmarkMs: 0,
      ...TIMING.fade,
    };
  }
  if (seenBefore) {
    return { kind: "short", doorsSwing: true, wordmark: false, wordmarkDelayMs: 0, wordmarkMs: 0, ...TIMING.short };
  }
  return { kind: "full", doorsSwing: true, wordmark: true, ...TIMING.full };
}

/** When the last thing in the plan finishes. */
export function planLength(plan: ThresholdPlan): number {
  return Math.max(
    plan.doorsSwing ? plan.doorsDelayMs + plan.doorsMs : 0,
    plan.wordmark ? plan.wordmarkDelayMs + plan.wordmarkMs : 0,
    plan.fadeDelayMs + plan.fadeMs,
  );
}
