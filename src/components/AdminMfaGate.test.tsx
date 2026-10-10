import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminMfaGate from "@/components/AdminMfaGate";

const mocks = vi.hoisted(() => ({
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  unenroll: vi.fn(),
  refreshSession: vi.fn(),
  user: { id: "test-admin" },
  roles: ["super_admin"],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel,
        listFactors: mocks.listFactors,
        enroll: mocks.enroll,
        challenge: mocks.challenge,
        verify: mocks.verify,
        unenroll: mocks.unenroll,
      },
      refreshSession: mocks.refreshSession,
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/useRBAC", () => ({
  useRBAC: () => ({ roles: mocks.roles, loading: false }),
}));

describe("AdminMfaGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatorAssuranceLevel
      .mockResolvedValueOnce({ data: { currentLevel: "aal1" }, error: null })
      .mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
    mocks.listFactors.mockResolvedValue({ data: { totp: [], phone: [] }, error: null });
    mocks.enroll.mockResolvedValue({
      data: { id: "pending-factor", totp: { qr_code: "data:image/png;base64,test", secret: "TEST-SETUP-SECRET" } },
      error: null,
    });
    mocks.challenge.mockResolvedValue({ data: { id: "challenge-1" }, error: null });
    mocks.verify.mockResolvedValue({ data: {}, error: null });
    mocks.refreshSession.mockResolvedValue({ data: { session: {} }, error: null });
    mocks.unenroll.mockResolvedValue({ data: {}, error: null });
  });

  it("shows QR and manual setup key during enrollment", async () => {
    render(<AdminMfaGate><div>Privileged dashboard</div></AdminMfaGate>);
    expect(await screen.findByAltText("Riverbanc administrator MFA QR code")).toBeInTheDocument();
    expect(screen.getByText("TEST-SETUP-SECRET")).toBeInTheDocument();
    expect(screen.queryByText("Privileged dashboard")).not.toBeInTheDocument();
  });

  it("grants the gate only after verification and confirmed AAL2", async () => {
    render(<AdminMfaGate><div>Privileged dashboard</div></AdminMfaGate>);
    const input = await screen.findByPlaceholderText("000000");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify MFA" }));
    expect(await screen.findByText("Privileged dashboard")).toBeInTheDocument();
    expect(mocks.verify).toHaveBeenCalledWith({
      factorId: "pending-factor",
      challengeId: "challenge-1",
      code: "123456",
    });
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("keeps privileged content blocked when verification fails", async () => {
    mocks.verify.mockResolvedValueOnce({ error: new Error("invalid code") });
    render(<AdminMfaGate><div>Privileged dashboard</div></AdminMfaGate>);
    const input = await screen.findByPlaceholderText("000000");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify MFA" }));
    expect(await screen.findByText(/Authenticator code was not accepted/)).toBeInTheDocument();
    expect(screen.queryByText("Privileged dashboard")).not.toBeInTheDocument();
  });
});
