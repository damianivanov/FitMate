import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import { useUserStore } from "@/stores/userStore";
import type { WorkoutTemplate } from "@/types";

export function useTemplatesPage() {
  const navigate = useNavigate();
  const isMobileViewport = useIsMobileViewport({ defaultValue: true });
  const currentUserId = useUserStore((state) => state.user.id);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const ownTemplates = useMemo(
    () => templates.filter((template) => currentUserId > 0 && template.userId === currentUserId),
    [currentUserId, templates],
  );

  const selectedTemplate = useMemo(
    () => ownTemplates.find((template) => template.id === selectedTemplateId) ?? null,
    [ownTemplates, selectedTemplateId],
  );

  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    setTemplatesError(null);

    try {
      const response = await workoutTemplateService.list();
      const result = response.data;
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Unable to load templates.");
      }

      setTemplates(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load templates.";
      setTemplates([]);
      setSelectedTemplateId(null);
      setTemplatesError(message);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!ownTemplates.length) {
      setSelectedTemplateId(null);
      return;
    }

    if (selectedTemplateId && ownTemplates.some((template) => template.id === selectedTemplateId)) {
      return;
    }

    setSelectedTemplateId(ownTemplates[0].id);
  }, [ownTemplates, selectedTemplateId]);

  const handleTemplateSelect = useCallback((templateId: number) => {
    setSelectedTemplateId(templateId);

    if (isMobileViewport) {
      navigate(`/templates/view/${templateId}`);
      return;
    }
  }, [isMobileViewport, navigate]);

  const handleCreateTemplateClick = useCallback(() => {
    navigate("/templates/new");
  }, [navigate]);

  return {
    templates: ownTemplates,
    selectedTemplate,
    isLoadingTemplates,
    templatesError,
    handleTemplateSelect,
    handleCreateTemplateClick,
    handleReloadTemplates: loadTemplates,
  };
}
