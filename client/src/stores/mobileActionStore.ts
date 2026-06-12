import { create } from "zustand";

/**
 * Lets a screen (currently the workout/template builders, via ExerciseBoard) publish a
 * primary "add" action that the mobile bottom nav's center button invokes instead of
 * navigating. When no action is registered the center button falls back to its NavLink.
 */
export interface MobileActionState {
  addExercise: (() => void) | null;
  setAddExercise: (handler: (() => void) | null) => void;
}

export const useMobileActionStore = create<MobileActionState>()((set) => ({
  addExercise: null,
  setAddExercise: (handler) => set({ addExercise: handler }),
}));
