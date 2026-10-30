import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RBACProvider, useRBAC } from "@/hooks/useRBAC";

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

const wrapper = ({ children }: { children: ReactNode }) => (
  <RBACProvider>{children}</RBACProvider>
);

describe("RBAC role loading failure and session changes", () => {
  beforeEach(() => {
    mocks.user = { id: "test-user" };
    mocks.select.mockReset();
    mocks.eq.mockReset();
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockResolvedValue({ data: [], error: null });
  });

  it("fails closed and clears loading when Supabase returns an error", async () => {
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

  it("does not retain privileged roles when the user changes", async () => {
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

  it("clears roles when the session has no authenticated user", async () => {
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

  it("ignores a stale role response after the authenticated user changes", async () => {
    let resolveFirst:
      | ((value: { data: { role: string }[]; error: null }) => void)
      | undefined;
    mocks.eq
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        data: [{ role: "user" }],
        error: null,
      });

    const { result, rerender } = renderHook(() => useRBAC(), { wrapper });
    mocks.user = { id: "second-user" };
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.roles).toEqual(["user"]);

    await act(async () => {
      resolveFirst?.({ data: [{ role: "super_admin" }], error: null });
    });
    expect(result.current.roles).toEqual(["user"]);
    expect(result.current.permissions.canManageUsers).toBe(false);
  });
});
