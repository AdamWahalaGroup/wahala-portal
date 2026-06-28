import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Pure-logic unit tests (state machine, RBAC policy) run in plain Node — no
// Workers runtime needed. Mirrors the tsconfig "@/*" -> "./src/*" path alias.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
