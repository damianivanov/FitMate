import { formatNumber, normalizeUtcIsoString } from "@/lib/helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const DAY_YEAR_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const FULL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function parseLoggedAt(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function atMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatRelativeDay(value: string): string {
  const date = parseLoggedAt(value);
  if (!date) {
    return value;
  }

  const now = new Date();
  const daysAgo = Math.round((atMidnight(now) - atMidnight(date)) / DAY_MS);

  if (daysAgo === 0) {
    return "Today";
  }

  if (daysAgo === 1) {
    return "Yesterday";
  }

  return date.getFullYear() === now.getFullYear()
    ? DAY_FORMATTER.format(date)
    : DAY_YEAR_FORMATTER.format(date);
}

export function formatFullDate(value: string | null): string {
  const date = parseLoggedAt(value);
  return date ? FULL_FORMATTER.format(date) : "—";
}

export function formatWeight(value: number | null | undefined): string {
  return value != null ? `${formatNumber(value, 1)} kg` : "—";
}

export function formatSignedWeight(value: number | null | undefined): string {
  if (value == null) {
    return "—";
  }

  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value), 1)} kg`;
}

export function formatDelta(value: number | null | undefined): string {
  if (value == null) {
    return "First entry";
  }

  return Math.abs(value) < 0.05 ? "No change" : formatSignedWeight(value);
}
