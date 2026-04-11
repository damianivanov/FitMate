import {
  clearStoredObject,
  loadStoredObject,
  saveStoredObject,
} from "@/lib/localStorage";

export const DRAFT_STORAGE_KEYS = {
  templateBuilder: "fitmate-template-builder-draft",
} as const;

export type KnownDraftStorageKey = (typeof DRAFT_STORAGE_KEYS)[keyof typeof DRAFT_STORAGE_KEYS];
export type DraftStorageKey = KnownDraftStorageKey | (string & {});

type LoadDraftStorageOptions<TValue> = {
  key: DraftStorageKey;
  version: number;
  validate?: (value: unknown) => value is TValue;
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

export function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isNumber(value);
}

export function isValue<TValue extends string | number | boolean>(
  value: unknown,
  allowedValues: readonly TValue[],
): value is TValue {
  return allowedValues.some((allowedValue) => allowedValue === value);
}

export function isArrayOf<TValue>(
  value: unknown,
  isItem: (item: unknown) => item is TValue,
): value is TValue[] {
  return Array.isArray(value) && value.every((item) => isItem(item));
}

export function loadDraftStorage<TValue>(
  options: LoadDraftStorageOptions<TValue>,
): TValue | null {
  return loadStoredObject<TValue>(options.key, {
    version: options.version,
    validate: options.validate,
  });
}

export function saveDraftStorage<TValue>(
  key: DraftStorageKey,
  value: TValue,
  version: number,
): boolean {
  return saveStoredObject(key, value, version);
}

export function clearDraftStorage(key: DraftStorageKey): void {
  clearStoredObject(key);
}
