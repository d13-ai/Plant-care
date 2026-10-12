/**
 * The opening sequence: the parlour doors swing open onto a lit room, the
 * wordmark comes up with "Come in.", and the room fades into the app. A
 * threshold, not a loading screen -- the app loads underneath the whole time,
 * so nothing here ever waits on data.
 *
 * Which version plays, and its timings, live here so they can be tuned in one
 * place and held to the brief by threshold.test.ts:
 *
 *  - every time the app is opened: the full sequence, about 3.9 seconds --
 *    on a cold start, and on coming back after being away a while
 *    (REPLAY_AFTER_MS), but not after a quick trip to the photo picker or a
 *    share sheet, which also send the app to the background;
 *  - "reduce motion" on: no doors swinging, only a fade.
 *
 * A tap anywhere skips it (SKIP_FADE_MS). src/components/threshold.tsx draws it.
 */
export type ThresholdKind = "full" | "fade";

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
 * Full: a beat on the closed doors, 1.6 s of opening, the wordmark rising as
 * they clear it, a long hold on the lit room and the wordmark, then a slow
 * fade -- 3.9 s in all. The brief asked for under 3 s with half a second's hold,
 * and a shorter doors-only version after the first launch; after seeing it,
 * David and Amanda wanted it slower, to linger on the room, and to have the
 * whole thing every time the app opens (12 Oct 2026). A tap skips it.
 */
export const TIMING = {
  full: {
    doorsDelayMs: 250,
    doorsMs: 1600,
    wordmarkDelayMs: 1300,
    wordmarkMs: 800,
    // wordmark fully in at 2100; held for 1100
    fadeDelayMs: 3200,
    fadeMs: 700,
  },
  fade: {
    fadeDelayMs: 250,
    fadeMs: 450,
  },
} as const;

/** How long a tap-to-skip takes to clear the doors away. */
export const SKIP_FADE_MS = 200;

/**
 * Away this long and coming back counts as opening the app again. Shorter
 * absences are the app's own detours -- the photo picker, the camera, a share
 * sheet, the in-app browser -- and doors after those would be in the way.
 */
export const REPLAY_AFTER_MS = 5 * 60 * 1000;

/** Whether coming back after `awayMs` in the background plays the doors again. */
export function replayOnReturn(awayMs: number): boolean {
  return awayMs >= REPLAY_AFTER_MS;
}

export function thresholdPlan({ reduceMotion }: { reduceMotion: boolean }): ThresholdPlan {
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
