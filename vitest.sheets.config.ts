import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/functions/sheets-export/handler.direct.test.ts"],
  },
});
