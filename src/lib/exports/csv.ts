/** RFC 4180 CSV writer with deterministic column order and LF line endings. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const headers = columns ?? Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}
