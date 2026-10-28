import { afterAll } from "vitest";

/**
 * Safety gate: tests truncate and regenerate data. They must never touch the
 * operational database, so the run aborts unless DATABASE_URL targets the
 * dedicated test database.
 */
const url = process.env.DATABASE_URL ?? "";
const isTestDatabase = /\/insurancelab_test(\?|$)/.test(url);

if (!isTestDatabase) {
  throw new Error(
    `Refusing to run destructive tests against "${url.replace(/\/\/[^@]*@/, "//***@")}". ` +
      "DATABASE_URL must point at insurancelab_test (see TEST_DATABASE_URL).",
  );
}

const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = "test";
env.APP_ENV = "test";

const { prisma } = await import("@/lib/db");

afterAll(async () => {
  await prisma.$disconnect();
});
