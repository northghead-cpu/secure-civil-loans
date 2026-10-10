import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./ForgotPasswordPage";
import { supabase } from "@/integrations/supabase/client";
import * as Sentry from "@sentry/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { resetPasswordForEmail: vi.fn() } },
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock("@sentry/react", () => ({ captureMessage: vi.fn() }));

const renderPage = () => render(
  <MemoryRouter>
    <ForgotPasswordPage />
  </MemoryRouter>,
);

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("provides retry and support guidance when the auth provider rejects the request", async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: { name: "AuthApiError", message: "SMTP authentication failed", status: 500, code: "unexpected_failure" } as never,
    });

    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "customer@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByRole("heading", { name: /check your email/i })).toBeInTheDocument();
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "customer@example.com",
      { redirectTo: expect.stringMatching(/\/reset-password$/) },
    );
    expect(screen.getByText(/didn't receive the email/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contact support/i })).toHaveAttribute(
      "href",
      "mailto:support@riverbanc.co.zm?subject=Password%20reset%20help",
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/smtp authentication failed/i)).not.toBeInTheDocument();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Password reset request rejected by auth provider",
      expect.objectContaining({
        tags: { flow: "password-reset", provider: "supabase-auth" },
        extra: expect.not.objectContaining({ email: expect.anything() }),
      }),
    );
  });

  it("allows the customer to retry after the generic confirmation", async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    } as never);

    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "customer@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await screen.findByRole("heading", { name: /check your email/i });
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/email address/i)).toHaveValue("customer@example.com");
  });
});
