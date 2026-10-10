import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerCareChat from "./CustomerCareChat";

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  loading: false,
  order: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user, loading: mocks.loading }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: mocks.order }),
      }),
    }),
    rpc: mocks.rpc,
  },
}));

const renderChat = () => render(
  <MemoryRouter><CustomerCareChat /></MemoryRouter>,
);

describe("CustomerCareChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = null;
    mocks.loading = false;
    mocks.order.mockResolvedValue({ data: [], error: null });
    mocks.rpc.mockResolvedValue({ data: "new-case-id", error: null });
  });

  it("opens as a customer-care bubble and directs signed-out visitors to sign in", () => {
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: /chat with customer care/i }));

    expect(screen.getByRole("region", { name: /riverbanc customer care chat/i })).toBeInTheDocument();
    expect(screen.getByText(/sign in to start a private conversation/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in to chat/i })).toHaveAttribute("href", "/login");
  });

  it("loads the signed-in customer's cases and offers a new conversation", async () => {
    mocks.user = { id: "customer-1" };
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: /chat with customer care/i }));

    expect(await screen.findByRole("heading", { name: /start a conversation/i })).toBeInTheDocument();
    expect(mocks.order).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /send to customer care/i })).toBeInTheDocument();
  });

  it("does not send an empty customer-care message", async () => {
    mocks.user = { id: "customer-1" };
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: /chat with customer care/i }));

    expect(await screen.findByRole("heading", { name: /start a conversation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send to customer care/i })).toBeDisabled();
  });
});
