import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import { useUserStore } from "@/stores/userStore";
import type { AdminUser, PagedResponse, UpdateUserRequest } from "@/types";
import { createUserGridColumns } from "../columns";
import type { UserFormValues } from "../components/UserEditorModal";

export function useUserGridPage() {
  const currentUserId = useUserStore((state) => state.user.id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const [pagedUsers, setPagedUsers] = useState<PagedResponse<AdminUser> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    async function loadRows() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.users.list({
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          search: debouncedSearch || undefined,
        });
        setPagedUsers(unwrap(response.data, "Unable to load users."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
        setPagedUsers(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRows();
  }, [debouncedSearch, paginationModel.page, paginationModel.pageSize, reloadIndex]);

  useEffect(() => {
    setPaginationModel((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [debouncedSearch]);

  const openEditEditor = useCallback((user: AdminUser) => {
    setEditingUser(user);
    setEditorError(null);
    setIsEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    if (isSaving) {
      return;
    }

    setIsEditorOpen(false);
    setEditingUser(null);
    setEditorError(null);
  }, [isSaving]);

  const onDelete = useCallback(
    async (user: AdminUser) => {
      if (user.id === currentUserId) {
        return;
      }

      const confirmed = window.confirm(`Delete user "${user.email}"? This cannot be undone.`);
      if (!confirmed) {
        return;
      }

      setActionError(null);

      try {
        const response = await adminService.users.remove(user.id);
        unwrap(response.data, "Delete failed.");
        setReloadIndex((index) => index + 1);
      } catch (deleteError) {
        setActionError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
      }
    },
    [currentUserId],
  );

  const columns = useMemo<GridColDef<AdminUser>[]>(
    () => createUserGridColumns({ currentUserId, onEdit: openEditEditor, onDelete }),
    [currentUserId, onDelete, openEditEditor],
  );

  const onSearchInputChange: ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    setSearchInput(event.target.value);
    setActionError(null);
  }, []);

  const changePagination = useCallback((model: GridPaginationModel) => {
    setPaginationModel(model);
    setActionError(null);
  }, []);

  const save = useCallback(
    async (values: UserFormValues) => {
      if (!editingUser) {
        return;
      }

      setIsSaving(true);
      setEditorError(null);

      const payload: UpdateUserRequest = {
        isAdmin: values.isAdmin,
        isActive: values.isActive,
      };

      try {
        const response = await adminService.users.update(editingUser.id, payload);
        unwrap(response.data, "Save failed.");

        setIsEditorOpen(false);
        setEditingUser(null);
        setReloadIndex((index) => index + 1);
      } catch (saveError) {
        setEditorError(saveError instanceof Error ? saveError.message : "Save failed.");
      } finally {
        setIsSaving(false);
      }
    },
    [editingUser],
  );

  const formValues = useMemo<UserFormValues>(
    () => ({
      isAdmin: editingUser?.isAdmin ?? false,
      isActive: editingUser?.isActive ?? true,
    }),
    [editingUser],
  );

  const state = useMemo(
    () => ({
      rows: pagedUsers?.items ?? [],
      rowCount: pagedUsers?.totalCount ?? 0,
      loading: isLoading,
      error: error ?? actionError,
      columns,
      searchInput,
      paginationModel,
      isEditorOpen,
      isSaving,
      editingUser,
      isSelfEditing: editingUser?.id === currentUserId,
      formValues,
      editorError,
    }),
    [
      pagedUsers,
      isLoading,
      error,
      actionError,
      columns,
      searchInput,
      paginationModel,
      isEditorOpen,
      isSaving,
      editingUser,
      currentUserId,
      formValues,
      editorError,
    ],
  );

  const actions = useMemo(
    () => ({
      onSearchInputChange,
      changePagination,
      closeEditor,
      save,
    }),
    [onSearchInputChange, changePagination, closeEditor, save],
  );

  return { state, actions };
}
