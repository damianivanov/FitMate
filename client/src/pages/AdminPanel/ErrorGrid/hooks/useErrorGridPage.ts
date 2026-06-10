import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type { ErrorModel, PagedResponse } from "@/types";
import { createErrorGridColumns } from "../columns";

export function useErrorGridPage() {
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const [pagedErrors, setPagedErrors] = useState<PagedResponse<ErrorModel> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  const [viewingError, setViewingError] = useState<ErrorModel | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    async function loadRows() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.errors.list({
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          search: debouncedSearch || undefined,
        });
        setPagedErrors(unwrap(response.data, "Unable to load errors."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load errors.");
        setPagedErrors(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRows();
  }, [debouncedSearch, paginationModel.page, paginationModel.pageSize, reloadIndex]);

  useEffect(() => {
    setPaginationModel((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [debouncedSearch]);

  const openDetail = useCallback((row: ErrorModel) => {
    setViewingError(row);
  }, []);

  const closeDetail = useCallback(() => {
    setViewingError(null);
  }, []);

  const onDelete = useCallback(async (row: ErrorModel) => {
    const confirmed = window.confirm("Delete this error log entry?");
    if (!confirmed) {
      return;
    }

    setActionError(null);

    try {
      const response = await adminService.errors.remove(row.id);
      unwrap(response.data, "Delete failed.");
      setReloadIndex((index) => index + 1);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    }
  }, []);

  const clearAll = useCallback(async () => {
    const confirmed = window.confirm("Delete ALL error log entries? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setIsClearing(true);

    try {
      const response = await adminService.errors.clearAll();
      unwrap(response.data, "Failed to clear errors.");
      setPaginationModel((current) => (current.page === 0 ? current : { ...current, page: 0 }));
      setReloadIndex((index) => index + 1);
    } catch (clearError) {
      setActionError(clearError instanceof Error ? clearError.message : "Failed to clear errors.");
    } finally {
      setIsClearing(false);
    }
  }, []);

  const columns = useMemo<GridColDef<ErrorModel>[]>(
    () => createErrorGridColumns({ onView: openDetail, onDelete }),
    [onDelete, openDetail],
  );

  const onSearchInputChange: ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    setSearchInput(event.target.value);
    setActionError(null);
  }, []);

  const changePagination = useCallback((model: GridPaginationModel) => {
    setPaginationModel(model);
    setActionError(null);
  }, []);

  const state = useMemo(
    () => ({
      rows: pagedErrors?.items ?? [],
      rowCount: pagedErrors?.totalCount ?? 0,
      loading: isLoading,
      error: error ?? actionError,
      columns,
      searchInput,
      paginationModel,
      viewingError,
      isClearing,
      hasRows: (pagedErrors?.totalCount ?? 0) > 0,
    }),
    [
      pagedErrors,
      isLoading,
      error,
      actionError,
      columns,
      searchInput,
      paginationModel,
      viewingError,
      isClearing,
    ],
  );

  const actions = useMemo(
    () => ({
      onSearchInputChange,
      changePagination,
      closeDetail,
      clearAll,
    }),
    [onSearchInputChange, changePagination, closeDetail, clearAll],
  );

  return { state, actions };
}
