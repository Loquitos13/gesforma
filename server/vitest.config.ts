import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Base temporária por ficheiro, definida antes de qualquer import de src/ (ver tests/ambiente.ts).
    setupFiles: ["tests/ambiente.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
