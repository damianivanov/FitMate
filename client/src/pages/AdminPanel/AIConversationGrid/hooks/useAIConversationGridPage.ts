import { useGridFilters } from "@/shared/components/tables/useGridFilters";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type {
  AIConversationDetailModel,
  AIConversationListItemModel,
  PagedResponse,
} from "@/types";
import { createConversationColumns } from "../columns";

export function useAIConversationGridPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const [paged, setPaged] = useState<PagedResponse<AIConversationListItemModel> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<AIConversationDetailModel | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const gridFilters = useGridFilters("conversations", 0, setPaginationModel);

  useEffect(() => {
    if (!gridFilters.ready) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.ai.listConversations({
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          search: debouncedSearch || undefined,
          columnFilters: gridFilters.selections,
        });
        if (cancelled) {
          return;
        }
        setPaged(unwrap(response.data, "Unable to load conversations."));
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Unable to load conversations.");
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
  ]);

  useEffect(() => {
    setPaginationModel((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [debouncedSearch]);

  const openDetail = useCallback(async (row: AIConversationListItemModel) => {
    setIsDetailLoading(true);
    setError(null);

    try {
      const response = await adminService.ai.getConversation(row.id);
      setDetail(unwrap(response.data, "Unable to load the conversation."));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the conversation.");
      setDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetail(null);
  }, []);

  const onSearchInputChange = useCallback<ChangeEventHandler<HTMLInputElement>>((event) => {
    setSearchInput(event.target.value);
  }, []);

  const columns = useMemo(
    () => createConversationColumns({ onView: (row) => void openDetail(row) }),
    [openDetail],
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
      detail,
      isDetailLoading,
    },
    actions: {
      onSearchInputChange,
      changePagination: setPaginationModel,
      closeDetail,
    },
  };
}
