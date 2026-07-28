import { useCallback, useEffect, useMemo, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { todayDateOnlyString } from "@/shared/utils/dateOnly";
import type { ProgramTodayModel } from "@/types";

export function useProgramToday() {
  const [todayModel, setTodayModel] = useState<ProgramTodayModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadToday() {
      setIsLoading(true);

      try {
        const response = await programPlanService.getToday(todayDateOnlyString());
        if (!cancelled) {
          setTodayModel(unwrap(response.data, "Unable to load today's program."));
        }
      } catch {
        // The dashboard card is non-critical: fail silent, render nothing.
        if (!cancelled) {
          setTodayModel(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadToday();

    return () => {
      cancelled = true;
    };
  }, [reloadIndex]);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);

  return useMemo(() => ({ todayModel, isLoading, reload }), [todayModel, isLoading, reload]);
}
