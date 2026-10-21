/** The client must use the request's bearer token, never a service-role key. */
interface UserClient {
  auth: { getUser(token: string): PromiseLike<{ data: { user: { id: string } | null }; error: unknown }> };
  from(table: "user_roles"): {
    select(columns: string): {
      eq(column: string, value: string): {
        in(column: string, values: string[]): {
          limit(count: number): PromiseLike<{ data: { role: string }[] | null; error: unknown }>;
        };
      };
    };
  };
}

type Authorization = { userId: string; status?: never; code?: never }
  | { userId?: never; status: 401 | 403 | 503; code: string };

/** Validate identity remotely before inspecting any JWT claim. Fail closed. */
export async function requirePrivilegedMfa(client: UserClient, header: string | null): Promise<Authorization> {
  if (!header?.startsWith("Bearer ")) return { status: 401, code: "AUTH_REQUIRED" };
  const token = header.slice(7);
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return { status: 401, code: "AUTH_REQUIRED" };
    let claims: Record<string, unknown>;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return { status: 401, code: "AUTH_REQUIRED" };
      const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
      if (!claims || typeof claims !== "object" || claims.sub !== data.user.id) {
        return { status: 401, code: "AUTH_REQUIRED" };
      }
    } catch {
      return { status: 401, code: "AUTH_REQUIRED" };
    }
    if (claims.aal !== "aal2") return { status: 403, code: "MFA_REQUIRED" };
    const roles = await client.from("user_roles").select("role")
      .eq("user_id", data.user.id).in("role", ["admin", "super_admin"]).limit(1);
    if (roles.error) return { status: 503, code: "AUTHORIZATION_UNAVAILABLE" };
    if (!roles.data?.some(row => ["admin", "super_admin"].includes(row.role))) {
      return { status: 403, code: "FORBIDDEN" };
    }
    return { userId: data.user.id };
  } catch {
    return { status: 503, code: "AUTHORIZATION_UNAVAILABLE" };
  }
}
