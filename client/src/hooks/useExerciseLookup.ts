import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { exerciseService } from "@/services/exerciseService";
import { useUserStore } from "@/stores/userStore";
import type { ExerciseLookupModel, ExerciseLookupRequest } from "@/types";

const DEFAULT_TAKE = 20;
const DEFAULT_SKIP = 0;
const DEFAULT_DEBOUNCE_MS = 260;
const DEFAULT_MIN_SEARCH_LENGTH = 1;
const DEFAULT_STALE_TIME_MS = 1000 * 30;
const MAX_CACHE_ENTRIES = 120;

type LookupCacheEntry = {
  options: ExerciseLookupModel[];
  cachedAtMs: number;
};

const lookupCache = new Map<string, LookupCacheEntry>();
const inFlightRequests = new Map<string, Promise<ExerciseLookupModel[]>>();

function buildCacheKey(params: ExerciseLookupRequest, cacheScope: string): string {
  return `${cacheScope}|${params.search ?? ""}|${(params.muscleGroupIds ?? []).join(",")}|${params.skip ?? 0}|${params.take}`;
}

function isCacheFresh(entry: LookupCacheEntry | undefined, staleTimeMs: number): boolean {
  return Boolean(entry && Date.now() - entry.cachedAtMs <= staleTimeMs);
}

function pruneLookupCache(staleTimeMs: number): void {
  const nowMs = Date.now();

  for (const [cacheKey, entry] of lookupCache.entries()) {
    if (nowMs - entry.cachedAtMs > staleTimeMs) {
      lookupCache.delete(cacheKey);
    }
  }

  if (lookupCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const sortedByAge = [...lookupCache.entries()].sort(
    (first, second) => first[1].cachedAtMs - second[1].cachedAtMs,
  );

  const overflowCount = lookupCache.size - MAX_CACHE_ENTRIES;
  for (let index = 0; index < overflowCount; index += 1) {
    const cacheKey = sortedByAge[index]?.[0];
    if (cacheKey) {
      lookupCache.delete(cacheKey);
    }
  }
}

async function fetchExerciseLookup(
  params: ExerciseLookupRequest,
  cacheScope: string,
  staleTimeMs: number,
  forceRefresh: boolean,
): Promise<ExerciseLookupModel[]> {
  pruneLookupCache(staleTimeMs);

  const cacheKey = buildCacheKey(params, cacheScope);
  const cached = lookupCache.get(cacheKey);
  if (!forceRefresh && isCacheFresh(cached, staleTimeMs) && cached) {
    return cached.options;
  }

  if (!forceRefresh) {
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const request = (async () => {
    try {
      const response = await exerciseService.getAll(params);
      const result = response.data;
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Unable to load exercises.");
      }

      lookupCache.set(cacheKey, {
        options: result.data,
        cachedAtMs: Date.now(),
      });

      return result.data;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, request);
  return request;
}

export function invalidateExerciseLookupCache(): void {
  lookupCache.clear();
  inFlightRequests.clear();
}

type UseExerciseLookupOptions = Partial<ExerciseLookupRequest> & {
  enabled?: boolean;
  debounceMs?: number;
  minSearchLength?: number;
  includeWhenSearchEmpty?: boolean;
  staleTimeMs?: number;
  onSuccess?: (options: ExerciseLookupModel[]) => void;
};

export function useExerciseLookup({
  search = "",
  muscleGroupIds,
  skip = DEFAULT_SKIP,
  take = DEFAULT_TAKE,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minSearchLength = DEFAULT_MIN_SEARCH_LENGTH,
  includeWhenSearchEmpty = false,
  staleTimeMs = DEFAULT_STALE_TIME_MS,
  onSuccess,
}: UseExerciseLookupOptions = {}) {
  const cacheScope = useUserStore((state) =>
    state.user.id > 0 ? `user:${state.user.id}` : "user:anon");
  const normalizedSearch = search.trim();
  const safeDebounceMs = Number.isFinite(debounceMs) && debounceMs >= 0 ? debounceMs : DEFAULT_DEBOUNCE_MS;
  const debouncedSearch = useDebouncedValue(normalizedSearch, safeDebounceMs);
  const [options, setOptions] = useState<ExerciseLookupModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const safeSkip = Number.isInteger(skip) && skip >= 0 ? skip : DEFAULT_SKIP;
  const safeTake = Number.isInteger(take) && take > 0 ? take : DEFAULT_TAKE;
  const safeMinSearchLength = Number.isInteger(minSearchLength)
    ? Math.max(0, minSearchLength)
    : DEFAULT_MIN_SEARCH_LENGTH;
  const safeStaleTimeMs = Number.isFinite(staleTimeMs) && staleTimeMs >= 0 ? staleTimeMs : DEFAULT_STALE_TIME_MS;
  const normalizedMuscleGroupIdsKey = useMemo(() => {
    if (!muscleGroupIds || muscleGroupIds.length === 0) {
      return "";
    }

    const unique = Array.from(
      new Set(muscleGroupIds.filter((id) => Number.isInteger(id) && id > 0)),
    );
    unique.sort((first, second) => first - second);
    return unique.join(",");
  }, [muscleGroupIds]);
  const hasSearch = debouncedSearch.length >= safeMinSearchLength;
  const hasFilter = normalizedMuscleGroupIdsKey.length > 0;
  const hasQuery = hasSearch || hasFilter || includeWhenSearchEmpty;
  const isDebouncing = enabled && normalizedSearch !== debouncedSearch;

  const requestParams = useMemo<ExerciseLookupRequest>(
    () => ({
      search: debouncedSearch || undefined,
      muscleGroupIds: normalizedMuscleGroupIdsKey
        ? normalizedMuscleGroupIdsKey.split(",").map(Number)
        : undefined,
      skip: safeSkip,
      take: safeTake,
    }),
    [debouncedSearch, normalizedMuscleGroupIdsKey, safeSkip, safeTake],
  );

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!enabled || !hasQuery) {
        requestRef.current += 1;
        setOptions([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      const currentRequest = ++requestRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchExerciseLookup(requestParams, cacheScope, safeStaleTimeMs, forceRefresh);

        if (currentRequest !== requestRef.current) {
          return;
        }

        setOptions(data);
        onSuccess?.(data);
      } catch (loadError) {
        if (currentRequest !== requestRef.current) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Unable to load exercises.";
        setOptions([]);
        setError(message);
      } finally {
        if (currentRequest === requestRef.current) {
          setIsLoading(false);
        }
      }
    },
    [cacheScope, enabled, hasQuery, onSuccess, requestParams, safeStaleTimeMs],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return useMemo(
    () => ({
      options,
      isLoading,
      error,
      hasQuery,
      isDebouncing,
      reload: () => load(true),
    }),
    [error, hasQuery, isDebouncing, isLoading, load, options],
  );
}
