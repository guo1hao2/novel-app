import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "expo-sqlite": resolve(__dirname, "tests/mocks/expoSqlite.ts")
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".claude/**", ".expo/**", "dist/**"]
  }
});
