import { useCallback, useEffect, useMemo, useState } from "react";
import { muscleGroupService } from "@/services/muscleGroupService";
import type { MuscleGroup } from "@/types";

const DEFAULT_STALE_TIME_MS = 1000 * 60 * 60 * 6;

let cachedMuscleGroups: MuscleGroup[] | null = null;
let cachedAtMs = 0;
let inFlightRequest: Promise<MuscleGroup[]> | null = null;

function isCacheFresh(staleTimeMs: number): boolean {
  return Boolean(cachedMuscleGroups && Date.now() - cachedAtMs <= staleTimeMs);
}

async function fetchMuscleGroups(staleTimeMs: number, forceRefresh: boolean): Promise<MuscleGroup[]> {
  if (!forceRefresh && isCacheFresh(staleTimeMs) && cachedMuscleGroups) {
    return cachedMuscleGroups;
  }

  if (!forceRefresh && inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = (async () => {
    try {
      const response = await muscleGroupService.getAllLookup();
      const result = response.data;
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Unable to load muscle groups.");
      }

      cachedMuscleGroups = result.data;
      cachedAtMs = Date.now();

      return result.data;
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
}

export function invalidateMuscleGroupsCache(): void {
  cachedMuscleGroups = null;
  cachedAtMs = 0;
  inFlightRequest = null;
}

type UseMuscleGroupsOptions = {
  enabled?: boolean;
  staleTimeMs?: number;
};

export function useMuscleGroups(options: UseMuscleGroupsOptions = {}) {
  const { enabled = true, staleTimeMs = DEFAULT_STALE_TIME_MS } = options;

  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>(() =>
    isCacheFresh(staleTimeMs) && cachedMuscleGroups ? cachedMuscleGroups : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => enabled && muscleGroups.length === 0);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!enabled) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchMuscleGroups(staleTimeMs, forceRefresh);
        setMuscleGroups(data);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load muscle groups.";
        setError(message);
        setMuscleGroups([]);
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, staleTimeMs],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return useMemo(
    () => ({
      muscleGroups,
      isLoading,
      error,
      reload: () => load(true),
    }),
    [error, isLoading, load, muscleGroups],
  );
}
