import { useCallback, useEffect, useState } from "react";
import type { ChangeEventHandler } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type { AIUserCostBreakdownModel, PagedResponse } from "@/types";

const PAGE_SIZE = 25;

export function useAIUserCostsPage() {
  const [days, setDays] = useState(30);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const [page, setPage] = useState(1);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  const [paged, setPaged] = useState<PagedResponse<AIUserCostBreakdownModel> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.ai.userCosts({
          page,
          pageSize: PAGE_SIZE,
          days,
          search: debouncedSearch || undefined,
        });
        setPaged(unwrap(response.data, "Unable to load AI costs."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load AI costs.");
        setPaged(null);
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [days, debouncedSearch, page]);

  useEffect(() => {
    setPage(1);
  }, [days, debouncedSearch]);

  const onSearchInputChange: ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    setSearchInput(event.target.value);
  }, []);

  const toggleExpanded = useCallback((userId: number) => {
    setExpandedUserId((current) => (current === userId ? null : userId));
  }, []);

  const rows = paged?.items ?? [];
  const totalCount = paged?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return {
    state: {
      rows,
      totalCount,
      totalPages,
      page,
      days,
      searchInput,
      isLoading,
      error,
      expandedUserId,
      grandTotalCost: rows.reduce((sum, row) => sum + row.estimatedCost, 0),
    },
    actions: {
      changeDays: setDays,
      onSearchInputChange,
      changePage: setPage,
      toggleExpanded,
    },
  };
}
