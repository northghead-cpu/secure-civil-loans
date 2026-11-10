// OCR fields can share a line, but must never consume subsequent field labels.
const nextField = /[ \t]+(?=(?:nrc(?:[ \t]+(?:no|number))?|passport[ \t]+(?:no|number)|date[ \t]+of[ \t]+(?:birth|expiry)|employee[ \t]+(?:no|number|id|name)|payroll[ \t]+(?:no|number)|pay[ \t]+period|gross[ \t]+(?:pay|salary)|net[ \t]+(?:pay|salary)|nationality|gender|sex|designation|employer|department)[ \t]*(?:[:#]|[ \t]+))/i;
const fieldHeading = /^(?:nrc|passport|date[ \t]+of|employee|payroll|pay[ \t]+period|gross|net|nationality|gender|sex|designation|employer|department)\b/i;

export function labeledOcrValue(text: string, labels: string): string | null {
  const lines = text.split(/\r?\n/);
  const pattern = new RegExp(`^[ \\t]*(?:${labels})\\b[ \\t]*:?[ \\t]*(.*)$`, "i");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (!match) continue;
    const raw = match[1].trim() || lines[i + 1]?.trim() || "";
    if (fieldHeading.test(raw)) continue;
    const value = raw.split(nextField)[0].trim().replace(/[ \t]+/g, " ");
    if (value) return value;
  }
  return null;
}

const notName = /\b(?:republic|zambia|passport|licence|license|ministry|national|government|transport|safety|agency|registration|authority|driving|document|identity|synthetic|test|only|valid|identification|pay[ \t]*slip|payroll|card|earnings|deductions|salary)\b/i;
const validName = (value: string): boolean => value.length >= 4 && value.length <= 100 && /^[\p{L}][\p{L} .’'-]*$/u.test(value) && value.split(/\s+/).length >= 2;

export function extractDocumentName(text: string): string | null {
  const labeled = labeledOcrValue(text, "full[ \\t]+name|legal[ \\t]+name|employee[ \\t]+name|name[ \\t]+of[ \\t]+holder|holder|bearer|names?|nom");
  // Explicit labels take precedence over the conservative unlabelled fallback.
  if (labeled && validName(labeled)) return labeled;
  const surname = labeledOcrValue(text, "surname"), given = labeledOcrValue(text, "given[ \\t]+names?");
  if (surname && given && validName(`${given} ${surname}`)) return `${given} ${surname}`;
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim().replace(/[ \t]+/g, " ");
    if (validName(value) && value === value.toLocaleUpperCase() && !notName.test(value)) return value;
  }
  return null;
}

export function extractDocumentEmployer(text: string): string | null {
  const labeled = labeledOcrValue(text, "employer|department|organisation|organization|company");
  if (labeled && labeled.length >= 4 && labeled.length <= 150) return labeled;
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim().split(nextField)[0].trim();
    if (/^MINISTRY[ \t]+OF[ \t]+[\p{L}][\p{L} &.,'-]+$/iu.test(value) && value.length <= 150) return value;
  }
  return null;
}
