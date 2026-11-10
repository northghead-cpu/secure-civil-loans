import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StrictKYCPage from "./StrictKYCPage";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  refresh: vi.fn(),
  parse: vi.fn(),
  error: vi.fn(),
  user: { id: "borrower" },
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    profile: { kyc_status: "PENDING" },
    loading: false,
    profileLoading: false,
    refreshProfile: mocks.refresh,
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));
vi.mock("@/integrations/supabase/untyped", () => ({
  untypedDb: { rpc: mocks.rpc },
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock("@/services/payrollParsingService", () => ({
  parsePayslip: mocks.parse,
}));
vi.mock("@/services/idDocumentParsingService", () => ({
  parseNRC: async () => ({
    success: true,
    full_name: "Test Borrower",
    document_number: "123456/78/1",
  }),
  parseGovernmentID: async () => ({ success: true, document_number: "TEST" }),
}));
describe("KYC recovery and replacement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: "2026-10-22", error: null });
    mocks.refresh.mockResolvedValue(null);
    mocks.parse.mockResolvedValue({
      success: true,
      pay_period: "September 2026",
      confidence: 90,
    });
  });
  it("offers a real retry after the application date lookup fails", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "offline" },
    });
    render(
      <MemoryRouter>
        <StrictKYCPage />
      </MemoryRouter>,
    );
    await screen.findByText("Verification could not load");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Identity" });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it("accepts replacing a payslip with a different file for the same month", async () => {
    const view = render(
      <MemoryRouter>
        <StrictKYCPage />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Identity" });
    const file = new File(["fixture"], "identity.png", {
      type: "image/png",
    });
    let inputs = view.container.querySelectorAll("input[type=file]");
    fireEvent.change(inputs[0], { target: { files: [file] } });
    await screen.findByText("identity.png");
    fireEvent.change(inputs[1], {
      target: {
        files: [
          new File(["fixture"], "government.png", { type: "image/png" }),
        ],
      },
    });
    await screen.findByText("government.png");
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await screen.findByRole("heading", { name: "Employment evidence" });
    inputs = view.container.querySelectorAll("input[type=file]");
    fireEvent.change(inputs[0], {
      target: {
        files: [
          new File(["fixture"], "first.png", { type: "image/png" }),
        ],
      },
    });
    await waitFor(() =>
      expect(screen.getByText("Accepted by OCR")).toBeInTheDocument(),
    );
    fireEvent.change(inputs[0], {
      target: {
        files: [
          new File(["fixture"], "replacement.png", { type: "image/png" }),
        ],
      },
    });
    await waitFor(() => expect(mocks.parse).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByText("Accepted by OCR")).toBeInTheDocument(),
    );
    expect(mocks.error).not.toHaveBeenCalled();
    fireEvent.change(inputs[0], {
      target: { files: [new File(["%PDF-1.7"], "replacement.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => expect(screen.queryByText("Accepted by OCR")).not.toBeInTheDocument());
    expect(mocks.parse).toHaveBeenCalledTimes(2);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Convert PDF pages to images"));
  });
  it("explains unsupported PDF OCR before accepting an identity document", async () => {
    const view = render(<MemoryRouter><StrictKYCPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Identity" });
    const inputs = view.container.querySelectorAll("input[type=file]");
    expect(inputs[0].getAttribute("accept")).not.toContain("pdf");
    fireEvent.change(inputs[0], {
      target: { files: [new File(["%PDF-1.7"], "identity.pdf", { type: "application/pdf" })] },
    });
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Convert PDF pages to images"));
    expect(screen.queryByText("identity.pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue/ })).toBeDisabled();
  });
});
