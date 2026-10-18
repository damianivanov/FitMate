import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { adminService, type AdminGridResource } from "@/services/adminService";
import { unwrap } from "@/lib/unwrap";
import type { GridColumnOptionsModel, GridColumnSelectionModel } from "@/types";

const emptyOptions: GridColumnOptionsModel[] = [];

export function useGridFilters(
  resource: AdminGridResource,
  reloadIndex: number,
  setPagination: Dispatch<SetStateAction<GridPaginationModel>>,
) {
  const [result, setResult] = useState<{
    key: string;
    options: GridColumnOptionsModel[] | null;
    error: string | null;
  }>({ key: "", options: null, error: null });
  const [selections, setSelections] = useState<GridColumnSelectionModel[]>([]);
  const [retryIndex, setRetryIndex] = useState(0);
  const key = `${resource}:${reloadIndex}:${retryIndex}`;
  const request = useRef<{
    key: string;
    promise: Promise<GridColumnOptionsModel[]>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (request.current?.key !== key) {
      request.current = {
        key,
        promise: adminService.gridOptions(resource).then((response) =>
          unwrap(response.data, "Unable to load column options.")),
      };
    }

    void request.current.promise.then((options) => {
      if (!cancelled) {
        setResult({ key, options, error: null });
      }
    }).catch((loadError: unknown) => {
      if (!cancelled) {
        setResult((current) => ({
          key,
          options: current.options,
          error: loadError instanceof Error ? loadError.message : "Unable to load column options.",
        }));
      }
    });

    return () => { cancelled = true; };
  }, [resource, key]);

  const changeSelection = useCallback((field: string, values: string[]) => {
    setPagination((current) => ({ ...current, page: 0 }));
    setSelections((current) => {
      const otherColumns = current.filter((selection) => selection.field !== field);
      return values.length ? [...otherColumns, { field, values }] : otherColumns;
    });
  }, [setPagination]);

  const clearSelections = useCallback(() => {
    setPagination((current) => ({ ...current, page: 0 }));
    setSelections([]);
  }, [setPagination]);

  const retry = useCallback(() => { setRetryIndex((current) => current + 1); }, []);

  return {
    options: result.options ?? emptyOptions,
    selections,
    ready: result.options !== null,
    loading: result.key !== key,
    error: result.key === key ? result.error : null,
    changeSelection, clearSelections, retry,
  };
}

export type GridFiltersState = ReturnType<typeof useGridFilters>;
