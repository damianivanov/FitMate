import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { exerciseService } from "@/services/exerciseService";
import { useUserStore } from "@/stores/userStore";
import type { ExerciseLookupModel, ExerciseLookupRequest } from "@/types";

const DEFAULT_TAKE = 20;
const DEFAULT_DEBOUNCE_MS = 260;
const DEFAULT_MIN_SEARCH_LENGTH = 1;
const DEFAULT_STALE_TIME_MS = 1000 * 30;

type LookupCacheEntry = {
  options: ExerciseLookupModel[];
  cachedAtMs: number;
};

const lookupCache = new Map<string, LookupCacheEntry>();
const inFlightRequests = new Map<string, Promise<ExerciseLookupModel[]>>();

function buildCacheKey(params: ExerciseLookupRequest, cacheScope: string): string {
  return `${cacheScope}|${params.search ?? ""}|${params.muscleGroupId ?? ""}|${params.take}`;
}

function isCacheFresh(entry: LookupCacheEntry | undefined, staleTimeMs: number): boolean {
  return Boolean(entry && Date.now() - entry.cachedAtMs <= staleTimeMs);
}

async function fetchExerciseLookup(
  params: ExerciseLookupRequest,
  cacheScope: string,
  staleTimeMs: number,
  forceRefresh: boolean,
): Promise<ExerciseLookupModel[]> {
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
      const response = await exerciseService.lookup(params);
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
};

export function useExerciseLookup({
  search = "",
  muscleGroupId,
  take = DEFAULT_TAKE,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minSearchLength = DEFAULT_MIN_SEARCH_LENGTH,
  includeWhenSearchEmpty = false,
  staleTimeMs = DEFAULT_STALE_TIME_MS,
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

  const safeTake = Number.isInteger(take) && take > 0 ? take : DEFAULT_TAKE;
  const safeMinSearchLength = Number.isInteger(minSearchLength)
    ? Math.max(0, minSearchLength)
    : DEFAULT_MIN_SEARCH_LENGTH;
  const safeStaleTimeMs = Number.isFinite(staleTimeMs) && staleTimeMs >= 0 ? staleTimeMs : DEFAULT_STALE_TIME_MS;
  const normalizedMuscleGroupId =
    typeof muscleGroupId === "number" && Number.isInteger(muscleGroupId) && muscleGroupId > 0
      ? muscleGroupId
      : undefined;
  const hasSearch = debouncedSearch.length >= safeMinSearchLength;
  const hasFilter = normalizedMuscleGroupId !== undefined;
  const hasQuery = hasSearch || hasFilter || includeWhenSearchEmpty;

  const requestParams = useMemo<ExerciseLookupRequest>(
    () => ({
      search: debouncedSearch || undefined,
      muscleGroupId: normalizedMuscleGroupId,
      take: safeTake,
    }),
    [debouncedSearch, normalizedMuscleGroupId, safeTake],
  );

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!enabled || !hasQuery) {
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
    [cacheScope, enabled, hasQuery, requestParams, safeStaleTimeMs],
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
      reload: () => load(true),
    }),
    [error, hasQuery, isLoading, load, options],
  );
}
