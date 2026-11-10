/**
 * Maps sheets-export error codes to user-facing messages. Never echoes
 * server-provided text, so provider bodies or secrets cannot leak into the UI.
 */
export type SheetsExportErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "MFA_REQUIRED"
  | "CONNECTOR_NOT_LINKED"
  | "PROVIDER_AUTH"
  | "PROVIDER_ERROR"
  | "SYNC_FAILED";

const MESSAGES: Record<SheetsExportErrorCode, string> = {
  AUTH_REQUIRED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "Only admins and super admins can use the reporting workbook.",
  MFA_REQUIRED: "Two-factor verification is required. Complete MFA and try again.",
  CONNECTOR_NOT_LINKED: "Google Sheets is not connected to this project.",
  PROVIDER_AUTH: "Google Sheets refused access. The Google connection may need to be reconnected or shared with the workbook.",
  PROVIDER_ERROR: "Google Sheets returned an error. Please try again shortly.",
  SYNC_FAILED: "The sync failed while preparing report data.",
};

export const SHEETS_UNKNOWN_ERROR = "Something went wrong. Please try again.";

export function sheetsExportErrorMessage(code: unknown): string {
  return typeof code === "string" && code in MESSAGES
    ? MESSAGES[code as SheetsExportErrorCode]
    : SHEETS_UNKNOWN_ERROR;
}

/** Extracts the `code` from a supabase.functions.invoke error/data pair. */
export async function readSheetsExportErrorCode(
  error: unknown,
  data: unknown,
): Promise<string | undefined> {
  const fromData = (data as { code?: unknown } | null)?.code;
  if (typeof fromData === "string") return fromData;
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = (await ctx.json()) as { code?: unknown };
      if (typeof body?.code === "string") return body.code;
    } catch {
      /* non-JSON body */
    }
  }
  return undefined;
}
