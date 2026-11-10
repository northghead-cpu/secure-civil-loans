import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ url: "https://zdpeaxkormwjrgllwalq.supabase.co" }));
vi.mock("@/integrations/supabase/config", () => ({ getSupabaseConfig: () => state }));
import { recoveryRedirect } from "../recoveryRedirect";
afterEach(() => vi.unstubAllEnvs());
describe("recovery environment isolation", () => {
  it("keeps production canonical but staging on its own origin", () => {
    vi.stubEnv("PROD", true);
    expect(recoveryRedirect("https://preview.example")).toBe("https://riverbanc.co.zm/reset-password");
    state.url = "https://mioppvtzbaixeeuxkroo.supabase.co";
    expect(recoveryRedirect("https://preview.example")).toBe("https://preview.example/reset-password");
  });
});
