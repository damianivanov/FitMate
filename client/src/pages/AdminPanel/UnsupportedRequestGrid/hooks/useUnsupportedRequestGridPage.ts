import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type {
  PagedResponse,
  UnsupportedAIRequestModel,
  UnsupportedRequestStatus,
  UpdateUnsupportedRequestRequest,
} from "@/types";
import { createUnsupportedColumns } from "../columns";

export function useUnsupportedRequestGridPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<UnsupportedRequestStatus | "">("");
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const [paged, setPaged] = useState<PagedResponse<UnsupportedAIRequestModel> | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  const [triageTarget, setTriageTarget] = useState<UnsupportedAIRequestModel | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.unsupportedRequests.list({
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          search: debouncedSearch || undefined,
          category: category || undefined,
          status: status === "" ? undefined : status,
        });
        setPaged(unwrap(response.data, "Unable to load requests."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load requests.");
        setPaged(null);
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [
    category,
    debouncedSearch,
    paginationModel.page,
    paginationModel.pageSize,
    reloadIndex,
    status,
  ]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await adminService.unsupportedRequests.categories();
        setCategories(unwrap(response.data, "Unable to load categories."));
      } catch {
        setCategories([]);
      }
    }

    void loadCategories();
  }, [reloadIndex]);

  useEffect(() => {
    setPaginationModel((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [category, debouncedSearch, status]);

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
      searchInput,
      category,
      status,
      categories,
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
      changeCategory: setCategory,
      changeStatus: setStatus,
      changePagination: setPaginationModel,
      closeTriage,
      save,
    },
  };
}
