import { defineConfig } from "@neon/config/v1";

// Neon services for VentureX. Every branch also gets Lakebase Postgres.
export default defineConfig({
  auth: true,
});
