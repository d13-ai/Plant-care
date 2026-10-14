/**
 * PlantParlour on Google Play. Here rather than in `src/lib/links.ts` so the
 * page shell (`src/app/+html.tsx`), which is rendered at build time, can name
 * it without pulling in the app's Supabase client.
 */
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=org.plantparlour.app";
