import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRBAC, RBACProvider } from "@/hooks/useRBAC";

const mocks = vi.hoisted(() => ({
  user: { id: "test-user" } as { id: string } | null,
  select: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mocks.select,
    })),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RBACProvider>{children}</RBACProvider>
);

describe("RBACProvider role loading", () => {
  beforeEach(() => {
    mocks.user = { id: "test-user" };
    mocks.select.mockReset();
    mocks.eq.mockReset();
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockResolvedValue({ data: [], error: null });
  });

  it("clears roles and completes loading when the role query fails", async () => {
    mocks.eq.mockResolvedValue({
      data: null,
      error: { message: "role query failed" },
    });

    const { result } = renderHook(() => useRBAC(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.roles).toEqual([]);
    expect(result.current.highestRole).toBeNull();
    expect(result.current.permissions.canManageUsers).toBe(false);
  });

  it("does not retain privileged roles when the authenticated user changes", async () => {
    mocks.eq.mockResolvedValueOnce({
      data: [{ role: "super_admin" }],
      error: null,
    });
    const { result, rerender } = renderHook(() => useRBAC(), { wrapper });

    await waitFor(() => expect(result.current.highestRole).toBe("super_admin"));

    mocks.user = { id: "different-user" };
    mocks.eq.mockResolvedValueOnce({ data: [], error: null });
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.roles).toEqual([]);
    expect(result.current.permissions.canManageUsers).toBe(false);
  });

  it("clears roles when the session has no user", async () => {
    mocks.eq.mockResolvedValueOnce({
      data: [{ role: "admin" }],
      error: null,
    });
    const { result, rerender } = renderHook(() => useRBAC(), { wrapper });
    await waitFor(() => expect(result.current.highestRole).toBe("admin"));

    act(() => {
      mocks.user = null;
    });
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.roles).toEqual([]);
    expect(result.current.highestRole).toBeNull();
  });
});
