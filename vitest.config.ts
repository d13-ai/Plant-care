import { defineConfig } from "vitest/config";

// Domain logic, the pure rules in the games' shared harness, and the page
// generators' rules -- what the library may say about pets. Screens are
// exercised on a device via Expo Go.
export default defineConfig({
  test: {
    include: ["src/domain/**/*.test.ts", "public/parlour-games/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
