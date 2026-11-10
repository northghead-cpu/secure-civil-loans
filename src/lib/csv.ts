/** Treat every exported field as text, including spreadsheet formula prefixes. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  let i = 0;
  while (i < text.length && (text.charCodeAt(i) <= 32 || text.charCodeAt(i) === 127 || /\s/u.test(text[i]))) i++;
  if ((text[i] && /[=+@-]/.test(text[i])) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function toCsvRows(rows: readonly (readonly unknown[])[]): string {
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
