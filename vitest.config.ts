import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import "dotenv/config";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not set. Refusing to run tests without a dedicated test database.");
}

export default defineConfig({
  resolve: {
    alias: { "@": resolve(process.cwd(), "src") },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", "_archive/**"],
    // Integration suites share one database, so files run sequentially.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      APP_ENV: "test",
      NODE_ENV: "test",
    },
  },
});
