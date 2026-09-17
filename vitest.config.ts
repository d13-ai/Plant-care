import { defineConfig } from "vitest/config";

// Domain logic, and the pure rules in the games' shared harness. Screens
// are exercised on a device via Expo Go.
export default defineConfig({
  test: {
    include: ["src/domain/**/*.test.ts", "public/parlour-games/**/*.test.ts"],
  },
});
