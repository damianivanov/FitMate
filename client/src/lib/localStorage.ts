export type StoredObjectEnvelope<TValue> = {
  version: number;
  savedAtUtc: string;
  data: TValue;
};

type LoadStoredObjectOptions<TValue> = {
  version: number;
  validate?: (value: unknown) => value is TValue;
};

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isStoredObjectEnvelope(value: unknown): value is StoredObjectEnvelope<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredObjectEnvelope<unknown>>;
  return (
    typeof candidate.version === "number"
    && typeof candidate.savedAtUtc === "string"
    && Object.prototype.hasOwnProperty.call(candidate, "data")
  );
}

export function saveStoredObject<TValue>(
  key: string,
  value: TValue,
  version: number,
): boolean {
  if (!canUseLocalStorage()) {
    return false;
  }

  const envelope: StoredObjectEnvelope<TValue> = {
    version,
    savedAtUtc: new Date().toISOString(),
    data: value,
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function loadStoredObject<TValue>(
  key: string,
  options: LoadStoredObjectOptions<TValue>,
): TValue | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isStoredObjectEnvelope(parsed)) {
    return null;
  }

  if (parsed.version !== options.version) {
    return null;
  }

  if (options.validate && !options.validate(parsed.data)) {
    return null;
  }

  return parsed.data as TValue;
}

export function clearStoredObject(key: string): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

