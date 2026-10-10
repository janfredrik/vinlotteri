import { defineConfig } from "vitest/config";

// Pin the time zone so date tests behave the same locally and in CI.
process.env.TZ = "Europe/Oslo";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
