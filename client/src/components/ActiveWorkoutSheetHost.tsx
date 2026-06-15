import { useEffect } from "react";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { getLiveStandaloneWorkoutId } from "@/lib/workoutSessionStorage";
import {
  selectActiveWorkoutStatus,
  useActiveWorkoutStore,
  WorkoutSheetStatus,
} from "@/stores/activeWorkoutStore";
import { WorkoutSheet } from "./WorkoutSheet";

/**
 * App-level host for the mobile workout sheet. Mounted once in Layout (a sibling of the
 * router <Outlet>), so the sheet survives route changes and the workout keeps running
 * while minimized. Renders nothing on desktop or when no workout is active — so the heavy
 * builder hook never mounts unless there is a live session.
 */
export function ActiveWorkoutSheetHost() {
  const isMobile = useIsMobileViewport({ defaultValue: false });
  const status = useActiveWorkoutStore(selectActiveWorkoutStatus);
  const workoutId = useActiveWorkoutStore((state) => state.workoutId);
  const templateId = useActiveWorkoutStore((state) => state.templateId);
  const isStarting = useActiveWorkoutStore((state) => state.isStarting);
  const minimize = useActiveWorkoutStore((state) => state.minimize);
  const close = useActiveWorkoutStore((state) => state.close);
  const setSessionMeta = useActiveWorkoutStore((state) => state.setSessionMeta);

  // Restore a live standalone session as a minimized mini-bar after a refresh (once).
  useEffect(() => {
    if (!isMobile) {
      return;
    }

    if (useActiveWorkoutStore.getState().status !== WorkoutSheetStatus.Closed) {
      return;
    }

    const restoredWorkoutId = getLiveStandaloneWorkoutId();
    if (restoredWorkoutId) {
      useActiveWorkoutStore.getState().restoreMinimized(restoredWorkoutId);
    }
  }, [isMobile]);

  if (!isMobile || status === WorkoutSheetStatus.Closed) {
    return null;
  }

  return (
    <WorkoutSheet
      status={status}
      workoutId={workoutId}
      templateId={templateId}
      isStarting={isStarting}
      onMinimize={minimize}
      onClose={close}
      onMetaChange={setSessionMeta}
    />
  );
}
