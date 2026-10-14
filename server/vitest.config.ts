import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Base temporária por ficheiro, definida antes de qualquer import de src/ (ver tests/ambiente.ts).
    setupFiles: ["tests/ambiente.ts"],
    // Com TEST_DATABASE_URL apaga no fim as bases Postgres criadas por ficheiro.
    globalSetup: ["tests/pgGlobal.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
