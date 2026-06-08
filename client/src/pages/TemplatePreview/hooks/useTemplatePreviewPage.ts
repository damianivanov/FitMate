import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useStartWorkoutFromTemplate } from "@/shared/hooks/useStartWorkoutFromTemplate";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import { unwrap } from "@/lib/unwrap";
import type { WorkoutTemplate } from "@/types";

function parseTemplateId(templateIdParam: string | undefined): number | null {
  const parsedTemplateId = Number(templateIdParam);
  return Number.isInteger(parsedTemplateId) && parsedTemplateId > 0 ? parsedTemplateId : null;
}

export function useTemplatePreviewPage() {
  const navigate = useNavigate();
  const { templateId: templateIdParam } = useParams<{ templateId?: string }>();
  const templateId = useMemo(() => parseTemplateId(templateIdParam), [templateIdParam]);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const { startingTemplateId, startWorkoutFromTemplate } = useStartWorkoutFromTemplate();

  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    async function loadTemplate() {
      if (!templateId) {
        setTemplate(null);
        setTemplateError("Template not found.");
        setIsLoadingTemplate(false);
        return;
      }

      setIsLoadingTemplate(true);
      setTemplateError(null);

      try {
        const response = await workoutTemplateService.getByIdWithListFallback(templateId);
        setTemplate(unwrap(response.data, "Unable to load template."));
      } catch (loadError) {
        setTemplate(null);
        setTemplateError(loadError instanceof Error ? loadError.message : "Unable to load template.");
      } finally {
        setIsLoadingTemplate(false);
      }
    }

    void loadTemplate();
  }, [templateId, reloadIndex]);

  const back = useCallback(() => {
    navigate("/templates");
  }, [navigate]);

  const edit = useCallback(() => {
    if (!template) {
      return;
    }

    navigate(`/templates/${template.id}`);
  }, [navigate, template]);

  const start = useCallback(() => {
    if (!template) {
      return;
    }

    void startWorkoutFromTemplate(template.id);
  }, [startWorkoutFromTemplate, template]);

  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const requestDelete = useCallback(() => {
    if (!template || isDeleting) {
      return;
    }

    setIsDeleteConfirmationOpen(true);
  }, [template, isDeleting]);

  const cancelDelete = useCallback(() => {
    if (isDeleting) {
      return;
    }

    setIsDeleteConfirmationOpen(false);
  }, [isDeleting]);

  const confirmDelete = useCallback(async () => {
    if (!template || isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await workoutTemplateService.remove(template.id);
      unwrap(response.data, "Unable to delete template.");
      toast.success("Template deleted.");
      navigate("/templates");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete template.");
      setIsDeleting(false);
    }
  }, [template, isDeleting, navigate]);

  const state = useMemo(
    () => ({
      template,
      isLoading: isLoadingTemplate,
      error: templateError,
      isStartingTemplate: template ? startingTemplateId === template.id : false,
      isActionable: Boolean(template) && !isLoadingTemplate && !templateError,
      isDeleteConfirmationOpen,
      isDeleting,
      templateName: template?.name ?? "",
    }),
    [
      template,
      templateError,
      startingTemplateId,
      isLoadingTemplate,
      isDeleteConfirmationOpen,
      isDeleting,
    ],
  );

  const actions = useMemo(
    () => ({
      back,
      edit,
      start,
      requestDelete,
      cancelDelete,
      confirmDelete,
      reload: () => setReloadIndex((index) => index + 1),
    }),
    [back, edit, start, requestDelete, cancelDelete, confirmDelete],
  );

  return { state, actions };
}
