export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function parseOptionalDecimal(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

export function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return undefined;
  }

  return parsed;
}

export function formatNumber(value: number, precision: number): string {
  const roundedValue = Number(value.toFixed(precision));
  return roundedValue.toString();
}

export function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildDisplayName(firstName?: string, lastName?: string): string {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ").trim();
}

export function buildInitials(firstName?: string, lastName?: string, email?: string): string {
  const first = firstName?.trim() ?? "";
  const last = lastName?.trim() ?? "";

  if (first || last) {
    const firstInitial = first.charAt(0);
    const secondInitial = last.charAt(0) || first.charAt(1);
    const initials = `${firstInitial}${secondInitial}`.trim().toUpperCase();
    if (initials) {
      return initials;
    }
  }

  const prefix = (email ?? "").split("@")[0].replace(/[^A-Za-z0-9]/g, "");
  return prefix.slice(0, 2).toUpperCase() || "U";
}

export const avatarColorSwatches = [
  {
    name: "Pacific Teal",
    hex: "#0F766E",
    className: "bg-[#0F766E]",
    textClassName: "text-white",
  },
  {
    name: "Signal Blue",
    hex: "#1D4ED8",
    className: "bg-[#1D4ED8]",
    textClassName: "text-white",
  },
  {
    name: "Royal Iris",
    hex: "#4338CA",
    className: "bg-[#4338CA]",
    textClassName: "text-white",
  },
  {
    name: "Electric Plum",
    hex: "#7E22CE",
    className: "bg-[#7E22CE]",
    textClassName: "text-white",
  },
  {
    name: "Raspberry",
    hex: "#BE123C",
    className: "bg-[#BE123C]",
    textClassName: "text-white",
  },
  {
    name: "Crimson Clay",
    hex: "#B91C1C",
    className: "bg-[#B91C1C]",
    textClassName: "text-white",
  },
  {
    name: "Burnt Orange",
    hex: "#C2410C",
    className: "bg-[#C2410C]",
    textClassName: "text-white",
  },
  {
    name: "Pine Green",
    hex: "#15803D",
    className: "bg-[#15803D]",
    textClassName: "text-white",
  },
  {
    name: "Graphite Blue",
    hex: "#334155",
    className: "bg-[#334155]",
    textClassName: "text-white",
  },
  {
    name: "Magenta Plum",
    hex: "#A21CAF",
    className: "bg-[#A21CAF]",
    textClassName: "text-white",
  },
] as const;

export function getAvatarColorClassName(userId?: number): string {
  const normalizedUserId = Number.isFinite(userId) ? Math.abs(Math.trunc(userId ?? 0)) : 0;
  const swatch = avatarColorSwatches[normalizedUserId % avatarColorSwatches.length];

  return `${swatch.className} ${swatch.textClassName}`;
}

export function formatDate(
  value: Date | string | null | undefined,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  if (!value) {
    return "";
  }

  const dateValue = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, options).format(dateValue);
}

export function formatDateTime(
  value: Date | string | null | undefined,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  return formatDate(value, locale, options);
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}
