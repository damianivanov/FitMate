import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import type { WorkoutTemplate } from "@/types";

function parseTemplateId(templateIdParam: string | undefined): number | null {
  const parsedTemplateId = Number(templateIdParam);
  return Number.isInteger(parsedTemplateId) && parsedTemplateId > 0 ? parsedTemplateId : null;
}

export function useTemplatePreviewPage() {
  const { templateId: templateIdParam } = useParams<{ templateId?: string }>();
  const templateId = useMemo(() => parseTemplateId(templateIdParam), [templateIdParam]);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const loadTemplate = useCallback(async () => {
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
      const result = response.data;
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Unable to load template.");
      }

      setTemplate(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load template.";
      setTemplate(null);
      setTemplateError(message);
    } finally {
      setIsLoadingTemplate(false);
    }
  }, [templateId]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  return {
    template,
    isLoadingTemplate,
    templateError,
    handleReloadTemplate: loadTemplate,
  };
}
