/**
 * Stand-in for the `react-native` module. `src/lib/supabase.ts` reads
 * `Platform.OS` to decide where to persist the auth session; reporting a
 * non-web platform puts the harness on the same AsyncStorage path a phone
 * takes, which is the app's primary target.
 */
export const Platform = { OS: "android" as const };
