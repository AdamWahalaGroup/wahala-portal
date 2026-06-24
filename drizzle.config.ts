import type { Config } from "drizzle-kit";

// Generates SQL migrations from src/db/schema.ts into drizzle/migrations.
// Apply them to D1 with `npm run db:migrate:local` / `db:migrate:remote`.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
} satisfies Config;
