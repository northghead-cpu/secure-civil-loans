/** Standard-font fallback is display-only; the original receipt record is retained. */
export function receiptDisplayText(value: string, supported: ReadonlySet<number>): string {
  return Array.from(value.replace(/[\r\n\t]/g, " ").slice(0, 500), ch => supported.has(ch.codePointAt(0)!) ? ch : "?").join("");
}
/** A poison receipt must not abort unrelated subscribers' delivery work. */
export async function runReceiptBatch<T>(rows: readonly T[], process: (row: T) => Promise<void>, failed: (row: T, error: unknown) => Promise<void>): Promise<void> {
  let recordingFailures = 0;
  for (const row of rows) {
    try { await process(row); } catch (error) {
      try { await failed(row, error); } catch { recordingFailures++; }
    }
  }
  if (recordingFailures) throw new Error("Receipt failures could not be recorded: " + recordingFailures);
}
