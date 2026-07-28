/**
 * Helpers for backend DateOnly values, which serialize as plain "yyyy-MM-dd" strings
 * (see ReinforcedTypingsConfiguration: DateOnly -> string).
 *
 * NEVER use `new Date("yyyy-MM-dd")` on these (parsed as UTC midnight — shifts a day in
 * negative-offset timezones) and NEVER build them with `toISOString()` (UTC date).
 */

export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The client's LOCAL calendar date — what the today/progress endpoints expect. */
export function todayDateOnlyString(): string {
  return toDateOnlyString(new Date());
}

/** Parses "yyyy-MM-dd" into a LOCAL Date at midnight. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

const SHORT_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const LONG_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** "Mon, 3 Aug" style label for a "yyyy-MM-dd" string. */
export function formatDateOnly(value: string): string {
  return SHORT_FORMATTER.format(parseDateOnly(value));
}

/** "Monday, August 3, 2026" style label for a "yyyy-MM-dd" string. */
export function formatDateOnlyLong(value: string): string {
  return LONG_FORMATTER.format(parseDateOnly(value));
}

/** Whole days from `from` to `to`, counting both ends. Negative when `to` < `from`. */
export function diffDaysInclusive(from: string, to: string): number {
  const millisPerDay = 86_400_000;
  const delta = parseDateOnly(to).getTime() - parseDateOnly(from).getTime();
  return Math.round(delta / millisPerDay) + 1;
}
