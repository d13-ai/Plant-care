import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Config for `npm run e2e` — the live check against Supabase. Kept apart from
 * `vitest.config.ts` so `npm test` stays offline and instant.
 *
 * The app's code is written for React Native, so the three device-only
 * modules are aliased to Node stand-ins; everything else (the db layer, the
 * Supabase client, the publish path) is the real thing.
 */
const stub = (name: string) => path.resolve(__dirname, "e2e/stubs", name);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react-native-url-polyfill\/auto$/, replacement: stub("empty.ts") },
      { find: /^@react-native-async-storage\/async-storage$/, replacement: stub("async-storage.ts") },
      { find: /^react-native$/, replacement: stub("react-native.ts") },
      { find: /^@\//, replacement: path.resolve(__dirname, "src") + "/" },
    ],
  },
  test: {
    include: ["e2e/**/*.e2e.test.ts"],
    // One plant's story told in order; the steps build on each other.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // .env holds the project URL and publishable key, same as the app reads.
    env: loadEnv("", process.cwd(), "EXPO_PUBLIC_"),
  },
});
