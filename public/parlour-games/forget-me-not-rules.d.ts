/** Types for Forget-Me-Not's rules, so they can be tested from TypeScript. */
export type Kind = { key: string; name: string; slug: string | null; fact: string; art: string };
export type Size = { key: string; label: string; pairs: number; cols: number };
export type Board = { size: string; cols: number; rows: number; cards: string[]; version: number; num?: number; seed?: number };
export type Position = { cards: string; up: number[]; turns: number };
export type Turn = {
  st: Position;
  event: "first" | "match" | "miss" | "hide" | "ignored";
  hid?: boolean;
  pair?: number[];
  kind?: string;
};
export type Nudge = { cells: number[]; why: string };
export type Daily = { num: number; cards: string; turns: number; done: boolean; nudged?: boolean } & Record<string, unknown>;
export type Progress = { done: number; bySize: Record<string, number>; nudgeFree: number; daily: Daily | null };

export declare const VERSION: number;
export declare const KINDS: Kind[];
export declare const SIZES: Size[];
export declare const PRACTICE: Board;
export declare const DAILY_SIZE: string;
export declare function kindOf(key: string): Kind | null;
export declare function sizeOf(key: string): Size;
export declare function shuffle<T>(list: T[], rnd: () => number): T[];
export declare function deal(sizeKey: string, rnd: () => number): Board;
export declare function dailySeed(day: number): number;
export declare function start(board: Board): Position;
export declare function turn(board: Board, st: Position, i: number): Turn;
export declare function found(st: Position): number;
export declare function isSolved(board: Board, st: Position): boolean;
export declare function partnerOf(board: Board, i: number): number;
export declare function nudge(board: Board, st: Position): Nudge | null;
export declare function describeCard(board: Board, st: Position, i: number): string;
export declare function shareText(num: number, pairs: number, turns: number, nudged: boolean): string;
export declare function emptyProgress(): Progress;
export declare function laterDaily(a: Daily | null, b: Daily | null): Daily | null;
export declare function mergeProgress(local: Progress, remote: Progress | null): Progress;
