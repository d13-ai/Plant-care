import { defineConfig } from "vitest/config";

// Domain logic only — screens are exercised on a device via Expo Go.
export default defineConfig({
  test: {
    include: ["src/domain/**/*.test.ts"],
  },
});
