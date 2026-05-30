import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { unwrap } from "@/lib/unwrap";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { workoutTemplateService } from "@/services/workoutTemplateService";
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

  // Derive the effective selection during render (no effect): keep the user's choice
  // while it is still valid, otherwise fall back to the first template.
  const selectedTemplate = useMemo(() => {
    if (!ownTemplates.length) {
      return null;
    }

    return ownTemplates.find((template) => template.id === selectedTemplateId) ?? ownTemplates[0];
  }, [ownTemplates, selectedTemplateId]);

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

  const state = useMemo(
    () => ({
      templates: ownTemplates,
      selectedTemplate,
      isLoading,
      error,
    }),
    [ownTemplates, selectedTemplate, isLoading, error],
  );

  const actions = useMemo(
    () => ({
      select,
      create,
      reload: () => setReloadIndex((index) => index + 1),
    }),
    [select, create],
  );

  return { state, actions };
}
