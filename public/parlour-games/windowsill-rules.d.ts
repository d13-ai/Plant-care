/** Types for Windowsill's rules, so they can be tested from TypeScript. */
export type Plant = { need: number; height: number };
export type Run = (Plant | null)[];
export type Shelf = Run[];
export type PlantState = "happy" | "scorching" | "leggy" | null;

export declare const MAX_LIGHT: number;
export declare const NEEDS: Record<number, string>;
export declare const HEIGHTS: Record<number, string>;
export declare function overtops(plant: Plant | null, t: number, behind: number): boolean;
export declare function blockersOf(run: Run, t: number): number[];
export declare function lightsFor(run: Run): number[];
export declare function stateOf(plant: Plant | null, light: number): PlantState;
export declare function shelfStates(shelf: Shelf): PlantState[][];
export declare function shelfLights(shelf: Shelf): number[][];
export declare function isSolved(shelf: Shelf): boolean;
export declare function fullRuns(d: number): Plant[][];
export type Shelf3 = { key: string; label: string; w: number; d: number; band: [number, number] };
export type Board = { w: number; d: number; tray: Plant[]; ways: number; tries: number; missed?: boolean };
export declare function countSolutions(w: number, d: number, pool: Plant[], runs?: Plant[][]): number;
export declare function solutions(w: number, d: number, pool: Plant[], limit?: number, runs?: Plant[][]): Plant[][][];
export declare const SHELVES: Shelf3[];
export declare const PRACTICE: { w: number; d: number; tray: Plant[] };
export declare function shuffle<T>(list: T[], rnd: () => number): T[];
export declare function deal(shelf: Shelf3, rnd: () => number, tries?: number): Board;
export declare function describe(plant: Plant | null): string;
