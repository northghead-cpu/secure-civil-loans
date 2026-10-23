/** Auth return paths stay on this origin and cannot create an auth redirect loop. */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    (raw.includes("\\") || [...raw].some(char => char.charCodeAt(0) <= 32))
  )
    return null;
  try {
    const url = new URL(raw, "https://riverbanc.invalid");
    if (
      url.origin !== "https://riverbanc.invalid" ||
      ["/login", "/reset-password", "/forgot-password"].includes(url.pathname)
    )
      return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
