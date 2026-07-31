import { useCallback, useEffect, useMemo, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type { LineChartPoint } from "@/shared/components";
import type { AIAdminOverviewModel } from "@/types";

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function useAIOverviewPage() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<AIAdminOverviewModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.ai.overview(days);
        setOverview(unwrap(response.data, "Unable to load the AI overview."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the AI overview.");
        setOverview(null);
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [days]);

  const costPoints = useMemo<LineChartPoint[]>(
    () =>
      (overview?.costByDay ?? []).map((point) => ({
        label: DAY_LABEL_FORMATTER.format(new Date(point.date)),
        value: point.estimatedCost,
      })),
    [overview],
  );

  const changeWindow = useCallback((value: number) => {
    setDays(value);
  }, []);

  return {
    state: { days, overview, isLoading, error, costPoints },
    actions: { changeWindow },
  };
}
