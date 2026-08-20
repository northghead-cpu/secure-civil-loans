import { describe, expect, it } from "vitest";
import { getSupabaseConfig } from "./config";

describe("getSupabaseConfig", () => {
  it("uses the canonical Civil Secure project when deployment variables are absent", () => {
    const config = getSupabaseConfig({});

    expect(config.url).toBe("https://zdpeaxkormwjrgllwalq.supabase.co");
    expect(config.publishableKey).toMatch(/^sb_publishable_/);
  });

  it("prefers deployment variables when they are present", () => {
    const config = getSupabaseConfig({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });

    expect(config).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });
});
