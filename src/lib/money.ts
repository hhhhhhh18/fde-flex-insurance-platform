import Decimal from "decimal.js";

// All financial arithmetic goes through Decimal. Binary floating point is never
// used for money. Intermediate rating values keep 6dp; payable amounts are
// rounded HALF_UP to 2dp at the final step only.
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 30,
});

export { Decimal };

/** Anything Prisma or JSON can hand us for a numeric column. */
export type Numeric = Decimal | string | number | bigint | { toString(): string };

export function dec(value: Numeric | null | undefined): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  if (value instanceof Decimal) return value;
  return new Decimal(value.toString());
}

export const ZERO = new Decimal(0);

/** Round to 2dp with HALF_UP - the only rounding used for monetary output. */
export function round2(value: Numeric): Decimal {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Round to 6dp with HALF_UP - used for rating factors and exposure units. */
export function round6(value: Numeric): Decimal {
  return dec(value).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

/** Canonical money string, e.g. "1234.50". Safe for JSON and NUMERIC columns. */
export function money(value: Numeric): string {
  return round2(value).toFixed(2);
}

/** Canonical 6dp factor string, e.g. "1.125000". */
export function factor(value: Numeric): string {
  return round6(value).toFixed(6);
}

/** Sum a list without accumulating floating-point error. */
export function sum(values: Numeric[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), ZERO);
}

export function min(a: Numeric, b: Numeric): Decimal {
  return Decimal.min(dec(a), dec(b));
}

export function max(a: Numeric, b: Numeric): Decimal {
  return Decimal.max(dec(a), dec(b));
}

/** Ratio as a percentage string, e.g. 12.5 for 0.125. */
export function percent(value: Numeric, digits = 1): string {
  return dec(value).times(100).toFixed(digits);
}

/** Format for display: 1234567.5 -> "1,234,567.50" */
export function formatMoney(value: Numeric, currency = "USD"): string {
  const fixed = money(value);
  const [whole, cents] = fixed.split(".");
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${withSeparators}.${cents}`;
}
