import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";
const state = vi.hoisted(() => ({ status: "active" }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test" },
    profile: { account_status: state.status },
    profileLoading: false,
    loading: false,
    isPasswordRecovery: false,
    signOut: vi.fn(),
  }),
}));
vi.mock("@/hooks/useRBAC", () => ({
  useRBAC: () => ({ highestRole: "user", loading: false }),
}));
describe("suspended account UI boundary", () => {
  it("does not mount protected features for a suspended account", () => {
    state.status = "suspended";
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <p>Private feature</p>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText("Account access paused")).toBeInTheDocument();
    expect(screen.queryByText("Private feature")).not.toBeInTheDocument();
  });
  it("allows active accounts to mount their authorised feature", () => {
    state.status = "active";
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <p>Private feature</p>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText("Private feature")).toBeInTheDocument();
  });
});
