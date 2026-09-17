/** Types for Windowsill's rules, so they can be tested from TypeScript. */
export type Plant = { need: number; height: number };
export type Run = (Plant | null)[];
export type Shelf = Run[];
export type PlantState = "happy" | "scorching" | "leggy" | null;

export declare const MAX_LIGHT: number;
export declare const NEEDS: Record<number, string>;
export declare const HEIGHTS: Record<number, string>;
export declare function overtops(plant: Plant | null, t: number, behind: number): boolean;
export declare function lightsFor(run: Run): number[];
export declare function stateOf(plant: Plant | null, light: number): PlantState;
export declare function shelfStates(shelf: Shelf): PlantState[][];
export declare function shelfLights(shelf: Shelf): number[][];
export declare function isSolved(shelf: Shelf): boolean;
export declare function fullRuns(d: number): Plant[][];
export declare function describe(plant: Plant | null): string;
