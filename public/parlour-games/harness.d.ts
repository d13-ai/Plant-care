/** Types for the plain-script harness, so its pure rules can be tested. */
export declare const EPOCH: number;
export declare function read<T>(key: string, fallback: T): T;
export declare function write(key: string, value: unknown): void;
export declare function mulberry32(seed: number): () => number;
export declare function dayNumber(when?: Date): number;
export declare function msUntilTomorrow(when?: Date): number;
export declare function mode(loc?: { pathname: string; search: string }): {
  learn: boolean; daily: boolean; embed: boolean;
};
export type Streak = { last: number | null; streak: number; longest: number; played: number };
export declare function getStreak(): Streak;
export declare function recordPlay(day: number): Streak;
export declare function mergeStreak(a: Streak | null, b: Streak | null): Streak | null;
export declare function adoptLegacyStreak(legacy: unknown): Streak;
export declare function session(): { access_token: string; user: { id: string } } | null;
export declare function token(): Promise<string | null>;
export declare function sync(opts: {
  game: string;
  local: () => unknown;
  merge: (local: unknown, remote: unknown) => unknown;
  apply: (merged: unknown) => void;
  onStatus: (signedIn: boolean, streak: Streak) => void;
}): { pull: () => Promise<unknown>; push: (immediate?: boolean) => Promise<void>; signInUrl: string };
export declare const signInUrl: string;
export declare function clockSaysNight(when?: Date): boolean;
export declare function night(opts: {
  key: string; dark?: string; light?: string; onApply?: (on: boolean) => void;
}): { isOn: () => boolean; apply: () => void; toggle: () => void };
export declare function sound(opts: Record<string, unknown>): {
  blip(i: number): void; fanfare(): void; startMusic(): void; stopMusic(): void;
  musicRunning(): boolean; musicAudible(): boolean;
  isOn(): boolean; setOn(on: boolean): void;
  levels(): { peak: number; rms: number } | null;
};
