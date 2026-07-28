import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { useActiveWorkoutStore } from "@/stores/activeWorkoutStore";

/**
 * Starts the workout for a scheduled program day. Desktop navigates into the workout,
 * mobile opens the workout sheet. The endpoint is idempotent, so a double-tap is safe.
 */
export function useStartProgramDay(onStarted?: () => void) {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
  const [startingDayId, setStartingDayId] = useState<number | null>(null);

  const startProgramDay = useCallback(
    async (programPlanDayId: number) => {
      if (startingDayId !== null) {
        return;
      }

      setStartingDayId(programPlanDayId);

      try {
        const response = await programPlanService.startDay(programPlanDayId);
        const workoutId = unwrap(response.data, "Unable to start workout.");
        onStarted?.();

        if (isMobile) {
          useActiveWorkoutStore.getState().openExistingWorkout(workoutId);
        } else {
          navigate(`/workouts/${workoutId}`);
        }
      } catch (startError) {
        toast.error(startError instanceof Error ? startError.message : "Unable to start workout.");
      } finally {
        setStartingDayId(null);
      }
    },
    [isMobile, navigate, onStarted, startingDayId],
  );

  return { startingDayId, startProgramDay };
}
