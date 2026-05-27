import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { workoutService } from "@/services/workoutService";

export function useStartWorkoutFromTemplate() {
  const navigate = useNavigate();
  const [startingTemplateId, setStartingTemplateId] = useState<number | null>(null);

  const startWorkoutFromTemplate = useCallback(async (templateId: number) => {
    if (startingTemplateId !== null) {
      return;
    }

    setStartingTemplateId(templateId);

    try {
      const response = await workoutService.startFromTemplate(templateId);
      const result = response.data;
      if (!result.success || result.data == null) {
        throw new Error(result.error ?? "Unable to start workout.");
      }

      navigate(`/workouts/${result.data}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start workout.";
      toast.error(message);
    } finally {
      setStartingTemplateId(null);
    }
  }, [navigate, startingTemplateId]);

  return {
    startingTemplateId,
    startWorkoutFromTemplate,
  };
}
