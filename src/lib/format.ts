/**
 * Display formatting. Money arrives from the API as a NUMERIC string and is only
 * formatted here - no arithmetic is performed on the client.
 */

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string): Intl.NumberFormat {
  const existing = currencyFormatters.get(currency);
  if (existing) return existing;
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  currencyFormatters.set(currency, formatter);
  return formatter;
}

export function formatCurrency(value: string | number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return "—";
  return currencyFormatter(currency).format(numeric);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCompactCurrency(value: string | number | null | undefined): string {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (Number.isNaN(numeric)) return "—";
  if (Math.abs(numeric) >= 1_000_000) return `$${(numeric / 1_000_000).toFixed(1)}M`;
  if (Math.abs(numeric) >= 10_000) return `$${(numeric / 1_000).toFixed(1)}k`;
  return formatCurrency(numeric);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

/** "AWAITING_INFORMATION" -> "Awaiting information" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Whole years between a date of birth and today (UTC-safe, used server-side). */
export function ageFromDate(value: string | Date, asOf: Date = new Date()): number | null {
  const dob = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(dob.getTime())) return null;
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = asOf.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}
