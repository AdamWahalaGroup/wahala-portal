import { defineConfig } from "drizzle-kit";

// Generate-only: migrations are applied through Wrangler (`db:migrate:*`),
// so no remote DB credentials are needed here.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
});
