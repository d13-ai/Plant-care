/** Types for Elbow Room's rules, so they can be tested from TypeScript. */
export type Technique = "single" | "confine" | "crowding" | "pigeonhole";
export type Board = {
  n: number;
  beds: number[];
  answer: number[];
  size: string;
  version: number;
  hardest?: Technique;
  attempts?: number;
};
export type Size = { key: string; label: string; n: number; min: Technique; max: Technique };
export type Clash = { type: string; index?: number; cells: number[]; words: string };
export type Unit = { kind: "row" | "col" | "bed"; index: number; cells?: number[] };
export type Step = {
  technique: Technique | "wrong" | "stuck";
  action: "plant" | "clear" | "move" | "none";
  cells: number[];
  units: Unit[];
  why: string;
};
export type Daily = { num: number; state: string; done: boolean; nudged?: boolean } & Record<string, unknown>;
export type Progress = { done: number; bySize: Record<string, number>; nudgeFree: number; daily: Daily | null };

export declare const VERSION: number;
export declare const TECHNIQUES: Technique[];
export declare const SIZES: Size[];
export declare const PRACTICE: Board;
export declare function sizeOf(key: string): Size;
export declare function shuffle<T>(list: T[], rnd: () => number): T[];
export declare function shadowOf(b: Board, cell: number): number[];
export declare function clashes(b: Board, state: string): Clash[];
export declare function isSolved(b: Board, state: string): boolean;
export declare function deadEnds(b: Board, state: string): (Unit & { cells: number[]; words: string })[];
export declare function solutions(b: Board, limit?: number): number[][];
export declare function reason(b: Board): { solved: boolean; hardest: Technique; steps: number };
export declare function nudge(b: Board, state: string): Step | null;
export declare function generate(size: string, rnd: () => number): Board | null;
export declare function fromPicture(rows: string[], extra?: Partial<Board>): Board;
export declare function dailySeed(day: number): number;
export declare function emptyProgress(): Progress;
export declare function laterDaily(a: Daily | null, b: Daily | null): Daily | null;
export declare function mergeProgress(local: Progress, remote: Progress | null): Progress;
export declare function describeCell(b: Board, state: string, cell: number): string;
