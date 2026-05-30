import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import type { SaveAsTemplatePayload } from "@/shared/components";
import type { Workout, WorkoutTemplate } from "@/types";

type UseSaveWorkoutAsTemplateOptions = {
  onSaved?: (template: WorkoutTemplate) => void;
};

function getWorkoutTitle(workout: Workout | null): string {
  return workout?.title.trim() || "Untitled Workout";
}

export function useSaveWorkoutAsTemplate(options?: UseSaveWorkoutAsTemplateOptions) {
  const [templateWorkout, setTemplateWorkout] = useState<Workout | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const open = useCallback((workout: Workout) => {
    setTemplateWorkout((current) => (isSavingTemplate ? current : workout));
  }, [isSavingTemplate]);

  const cancel = useCallback(() => {
    setTemplateWorkout((current) => (isSavingTemplate ? current : null));
  }, [isSavingTemplate]);

  const confirm = useCallback(async (payload: SaveAsTemplatePayload) => {
    if (!templateWorkout || isSavingTemplate) {
      return;
    }

    setIsSavingTemplate(true);

    try {
      const response = await workoutTemplateService.createFromWorkout(templateWorkout.id, {
        name: payload.name,
        description: payload.description,
        isPublic: payload.isPublic,
      });
      const result = response.data;
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Unable to create template.");
      }

      toast.success(`Template "${result.data.name}" created.`);
      setTemplateWorkout(null);
      options?.onSaved?.(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create template.";
      toast.error(message);
    } finally {
      setIsSavingTemplate(false);
    }
  }, [isSavingTemplate, options, templateWorkout]);

  return {
    isSaveAsTemplateOpen: Boolean(templateWorkout),
    saveAsTemplateDefaultName: useMemo(() => getWorkoutTitle(templateWorkout), [templateWorkout]),
    isSavingTemplate,
    handleSaveAsTemplateRequest: open,
    handleCancelSaveAsTemplate: cancel,
    handleConfirmSaveAsTemplate: confirm,
  };
}
