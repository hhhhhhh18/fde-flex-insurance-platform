import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm start",
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      // Point the E2E server at a scratch database so tests never mutate the
      // preserved operational dataset. Falls back to the configured DATABASE_URL.
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
    },
  },
});
