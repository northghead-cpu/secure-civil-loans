import { describe, it, expect, vi } from "vitest";
import { requirePrivilegedMfa } from "../../../supabase/functions/_shared/privileged-auth";

const userId = "00000000-0000-4000-8000-000000000001";
const bearer = (claims: unknown) =>
  `Bearer header.${btoa(JSON.stringify(claims))}.signature`;
function client(
  options: {
    authError?: boolean;
    roles?: string[];
    roleError?: boolean;
    suspended?: boolean;
  } = {},
) {
  const limit = vi.fn().mockResolvedValue({
    data: (options.roles ?? ["admin"]).map((role) => ({ role })),
    error: options.roleError ? new Error("offline") : null,
  });
  const rolesForUser = limit;
  const getUser = vi
    .fn()
    .mockResolvedValue({
      data: { user: options.authError ? null : { id: userId } },
      error: options.authError ? new Error("invalid") : null,
    });
  return {
    auth: { getUser },
    rolesForUser,
    accountForUser: vi
      .fn()
      .mockResolvedValue({
        data: { account_status: options.suspended ? "suspended" : "active" },
        error: null,
      }),
  };
}

describe("privileged Edge authorization", () => {
  it("rejects a missing bearer without calling Auth", async () => {
    const db = client();
    expect(await requirePrivilegedMfa(db, null)).toEqual({
      status: 401,
      code: "AUTH_REQUIRED",
    });
    expect(db.auth.getUser).not.toHaveBeenCalled();
  });
  it("never trusts forged AAL2 or role claims without remote validation", async () => {
    const db = client({ authError: true });
    expect(
      await requirePrivilegedMfa(
        db,
        bearer({ sub: userId, aal: "aal2", role: "admin" }),
      ),
    ).toMatchObject({ status: 401 });
    expect(db.rolesForUser).not.toHaveBeenCalled();
  });
  it.each([undefined, "aal1", "aal3"])(
    "rejects a privileged session at assurance %s",
    async (aal) => {
      const db = client();
      expect(
        await requirePrivilegedMfa(db, bearer({ sub: userId, aal })),
      ).toEqual({ status: 403, code: "MFA_REQUIRED" });
      expect(db.rolesForUser).not.toHaveBeenCalled();
    },
  );
  it("rejects a token subject that differs from the verified identity", async () => {
    expect(
      await requirePrivilegedMfa(
        client(),
        bearer({ sub: "other", aal: "aal2" }),
      ),
    ).toMatchObject({ status: 401 });
  });
  it("rejects malformed claims even when Auth returns a user", async () => {
    expect(
      await requirePrivilegedMfa(client(), "Bearer not-a-jwt"),
    ).toMatchObject({ status: 401 });
    expect(await requirePrivilegedMfa(client(), bearer(null))).toMatchObject({
      status: 401,
    });
  });
  it("ignores user-editable metadata and requires a database role", async () => {
    expect(
      await requirePrivilegedMfa(
        client({ roles: [] }),
        bearer({
          sub: userId,
          aal: "aal2",
          user_metadata: { role: "super_admin" },
        }),
      ),
    ).toEqual({ status: 403, code: "FORBIDDEN" });
  });
  it("fails closed when the role lookup fails", async () => {
    expect(
      await requirePrivilegedMfa(
        client({ roleError: true }),
        bearer({ sub: userId, aal: "aal2" }),
      ),
    ).toEqual({ status: 503, code: "AUTHORIZATION_UNAVAILABLE" });
  });
  it("blocks suspended administrators before any privileged operation", async () => {
    expect(
      await requirePrivilegedMfa(
        client({ suspended: true }),
        bearer({ sub: userId, aal: "aal2" }),
      ),
    ).toEqual({ status: 403, code: "ACCOUNT_SUSPENDED" });
  });
  it("allows verified AAL2 administrators, including accounts with both roles", async () => {
    expect(
      await requirePrivilegedMfa(
        client({ roles: ["admin", "super_admin"] }),
        bearer({ sub: userId, aal: "aal2" }),
      ),
    ).toEqual({ userId, role: "admin" });
  });
  it("fails closed on Auth transport errors", async () => {
    const db = client();
    db.auth.getUser.mockRejectedValue(new Error("unavailable"));
    expect(
      await requirePrivilegedMfa(db, bearer({ sub: userId, aal: "aal2" })),
    ).toMatchObject({ status: 503 });
  });
});
