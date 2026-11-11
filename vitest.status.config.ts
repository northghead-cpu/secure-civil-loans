import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["supabase/functions/handshake-status/handler.test.ts"] },
});
