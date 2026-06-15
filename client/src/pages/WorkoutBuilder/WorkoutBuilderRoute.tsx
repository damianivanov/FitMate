import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { useActiveWorkoutStore } from "@/stores/activeWorkoutStore";
import WorkoutBuilder from "./WorkoutBuilder";

function parseWorkoutId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Route element for /workouts/new and /workouts/:workoutId.
 *
 * On DESKTOP it renders the full-page builder as before. On MOBILE it instead hands the
 * workout to the app-level sheet (so it keeps running while minimized) and redirects to the
 * workouts list as the underlying page — making every entry point (list, calendar, summary,
 * stray links, direct URLs) open the sheet, never a second full-page builder.
 */
export default function WorkoutBuilderRoute() {
  const isMobile = useIsMobileViewport({ defaultValue: false });
  const { workoutId: workoutIdParam } = useParams<{ workoutId?: string }>();
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    if (!isMobile || handledRef.current) {
      return;
    }
    handledRef.current = true;

    const workoutId = parseWorkoutId(workoutIdParam);
    const store = useActiveWorkoutStore.getState();
    if (workoutId) {
      store.openExistingWorkout(workoutId);
    } else {
      store.openNewWorkout();
    }

    navigate("/workouts", { replace: true });
  }, [isMobile, workoutIdParam, navigate]);

  if (isMobile) {
    return null;
  }

  return <WorkoutBuilder />;
}
