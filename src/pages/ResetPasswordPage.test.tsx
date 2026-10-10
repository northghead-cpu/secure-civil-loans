import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "./ResetPasswordPage";
import { supabase } from "@/integrations/supabase/client";
import * as Sentry from "@sentry/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isPasswordRecovery: true, clearPasswordRecovery: vi.fn() }),
}));
vi.mock("@sentry/react", () => ({ captureMessage: vi.fn() }));

const renderPage = () => render(
  <MemoryRouter initialEntries={["/reset-password#type=recovery&access_token=test-token"]}>
    <ResetPasswordPage />
  </MemoryRouter>,
);

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);
  });

  it("does not expose the password form before a valid session exists", async () => {
    renderPage();

    expect(await screen.findByText(/verifying your reset link/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /update password/i })).not.toBeInTheDocument();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("shows the password form only after confirming a session", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: "test-user" } } },
      error: null,
    } as never);

    renderPage();

    expect(await screen.findByRole("button", { name: /update password/i })).toBeInTheDocument();
  });

  it("reports a safe recovery-specific error when Supabase rejects the update", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: "test-user" } } },
      error: null,
    } as never);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", code: "session_not_found", status: 401, message: "Auth session missing" },
    } as never);

    renderPage();

    fireEvent.change(await screen.findByLabelText(/new password/i), {
      target: { value: "ValidPassword123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: "ValidPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByText(/your reset link may have expired/i)).toBeInTheDocument();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Password reset update rejected by auth provider",
      expect.objectContaining({
        tags: expect.objectContaining({ flow: "password-reset", stage: "update-password" }),
        extra: expect.objectContaining({ errorCode: "session_not_found" }),
      }),
    );
  });
});
