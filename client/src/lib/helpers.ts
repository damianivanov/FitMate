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
