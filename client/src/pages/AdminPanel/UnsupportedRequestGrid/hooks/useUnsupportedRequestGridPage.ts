import { useGridFilters } from "@/shared/components/tables/useGridFilters";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type {
  PagedResponse,
  UnsupportedAIRequestModel,
  UpdateUnsupportedRequestRequest,
} from "@/types";
import { createUnsupportedColumns } from "../columns";

export function useUnsupportedRequestGridPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const [paged, setPaged] = useState<PagedResponse<UnsupportedAIRequestModel> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  const [triageTarget, setTriageTarget] = useState<UnsupportedAIRequestModel | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const gridFilters = useGridFilters("unsupportedRequests", reloadIndex, setPaginationModel);

  useEffect(() => {
    if (!gridFilters.ready) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.unsupportedRequests.list({
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          search: debouncedSearch || undefined,
          columnFilters: gridFilters.selections,
        });
        if (cancelled) {
          return;
        }
        setPaged(unwrap(response.data, "Unable to load requests."));
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Unable to load requests.");
        setPaged(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    gridFilters.ready,
    gridFilters.selections,
    debouncedSearch,
    paginationModel.page,
    paginationModel.pageSize,
    reloadIndex,
  ]);

  useEffect(() => {
    setPaginationModel((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [debouncedSearch]);

  const openTriage = useCallback(async (row: UnsupportedAIRequestModel) => {
    try {
      // The grid row carries no occurrence examples; the detail endpoint does.
      const response = await adminService.unsupportedRequests.getById(row.id);
      setTriageTarget(unwrap(response.data, "Unable to load the request."));
    } catch {
      setTriageTarget(row);
    }
  }, []);

  const closeTriage = useCallback(() => {
    setTriageTarget(null);
  }, []);

  const save = useCallback(
    async (payload: UpdateUnsupportedRequestRequest) => {
      if (!triageTarget) {
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        await adminService.unsupportedRequests.update(triageTarget.id, payload);
        setTriageTarget(null);
        setReloadIndex((current) => current + 1);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save the request.");
      } finally {
        setIsSaving(false);
      }
    },
    [triageTarget],
  );

  const onSearchInputChange = useCallback<ChangeEventHandler<HTMLInputElement>>((event) => {
    setSearchInput(event.target.value);
  }, []);

  const columns = useMemo(
    () => createUnsupportedColumns({ onTriage: (row) => void openTriage(row) }),
    [openTriage],
  );

  return {
    state: {
      gridFilters,
      searchInput,
      columns,
      rows: paged?.items ?? [],
      rowCount: paged?.totalCount ?? 0,
      loading: isLoading,
      paginationModel,
      error,
      triageTarget,
      isSaving,
    },
    actions: {
      onSearchInputChange,
      changePagination: setPaginationModel,
      closeTriage,
      save,
    },
  };
}
