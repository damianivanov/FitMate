import {
  clearStoredObject,
  loadStoredObject,
  saveStoredObject,
} from "@/lib/localStorage";

export const DRAFT_STORAGE_KEYS = {
  templateBuilder: "fitmate-template-builder-draft",
} as const;

type DraftStorageKey = (typeof DRAFT_STORAGE_KEYS)[keyof typeof DRAFT_STORAGE_KEYS] | (string & {});

type LoadDraftStorageOptions = {
  key: DraftStorageKey;
  version: number;
};

export function loadDraftStorage<TValue>(
  options: LoadDraftStorageOptions,
): TValue | null {
  return loadStoredObject<TValue>(options.key, {
    version: options.version,
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
