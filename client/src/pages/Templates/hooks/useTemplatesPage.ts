import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import { useStartWorkoutFromTemplate } from "@/shared/hooks/useStartWorkoutFromTemplate";
import { useUserStore } from "@/stores/userStore";
import type { WorkoutTemplate } from "@/types";

export function useTemplatesPage() {
  const navigate = useNavigate();
  const isMobileViewport = useIsMobileViewport({ defaultValue: true });
  const currentUserId = useUserStore((state) => state.user.id);
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    async function loadTemplates() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await workoutTemplateService.list();
        setTemplates(unwrap(response.data, "Unable to load templates."));
      } catch (loadError) {
        setTemplates(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load templates.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadTemplates();
  }, [reloadIndex]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const ownTemplates = useMemo(
    () =>
      (templates ?? []).filter(
        (template) => currentUserId > 0 && template.userId === currentUserId,
      ),
    [currentUserId, templates],
  );

  const selectedTemplate = useMemo(() => {
    if (!ownTemplates.length) {
      return null;
    }

    return ownTemplates.find((template) => template.id === selectedTemplateId) ?? ownTemplates[0];
  }, [ownTemplates, selectedTemplateId]);

  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const [templatePendingDelete, setTemplatePendingDelete] = useState<WorkoutTemplate | null>(null);
  const { startingTemplateId, startWorkoutFromTemplate } = useStartWorkoutFromTemplate();

  const select = useCallback(
    (templateId: number) => {
      setSelectedTemplateId(templateId);

      if (isMobileViewport) {
        navigate(`/templates/view/${templateId}`);
        return;
      }
    },
    [isMobileViewport, navigate],
  );

  const create = useCallback(() => {
    navigate("/templates/new");
  }, [navigate]);

  const edit = useCallback(
    (templateId: number) => {
      navigate(`/templates/${templateId}`);
    },
    [navigate],
  );

  const start = useCallback(
    (templateId: number) => {
      void startWorkoutFromTemplate(templateId);
    },
    [startWorkoutFromTemplate],
  );

  const requestDelete = useCallback(
    (template: WorkoutTemplate) => {
      if (deletingTemplateId !== null) {
        return;
      }

      setTemplatePendingDelete(template);
    },
    [deletingTemplateId],
  );

  const cancelDelete = useCallback(() => {
    if (deletingTemplateId !== null) {
      return;
    }

    setTemplatePendingDelete(null);
  }, [deletingTemplateId]);

  const confirmDelete = useCallback(async () => {
    if (!templatePendingDelete || deletingTemplateId !== null) {
      return;
    }

    const template = templatePendingDelete;
    setDeletingTemplateId(template.id);

    try {
      const response = await workoutTemplateService.remove(template.id);
      unwrap(response.data, "Unable to delete template.");

      setTemplates((current) => (current ?? []).filter((item) => item.id !== template.id));
      setTemplatePendingDelete(null);
      toast.success("Template deleted.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete template.");
    } finally {
      setDeletingTemplateId(null);
    }
  }, [deletingTemplateId, templatePendingDelete]);

  const state = useMemo(
    () => ({
      templates: ownTemplates,
      selectedTemplate,
      isLoading,
      error,
      startingTemplateId,
      deletingTemplateId,
      isDeleteConfirmationOpen: Boolean(templatePendingDelete),
      templatePendingDeleteName: templatePendingDelete?.name ?? "",
    }),
    [
      ownTemplates,
      selectedTemplate,
      isLoading,
      error,
      startingTemplateId,
      deletingTemplateId,
      templatePendingDelete,
    ],
  );

  const actions = useMemo(
    () => ({
      select,
      create,
      edit,
      start,
      requestDelete,
      cancelDelete,
      confirmDelete,
      reload: () => setReloadIndex((index) => index + 1),
    }),
    [select, create, edit, start, requestDelete, cancelDelete, confirmDelete],
  );

  return { state, actions };
}
