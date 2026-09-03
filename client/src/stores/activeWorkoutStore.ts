import { create } from "zustand";
import type { AIProposalExerciseModel } from "@/types";

/**
 * Lifecycle of the app-level (mobile) workout sheet.
 *
 * Closed     — no live workout; the sheet host renders nothing.
 * Open        — sheet is up, full-screen takeover.
 * Minimized   — sheet is parked off-screen but STILL MOUNTED (the workout keeps
 *               running); the mini-bar + blinking dumbbell indicate it.
 *
 * Use the enum, never the raw string values, everywhere this status is read or set.
 */
export enum WorkoutSheetStatus {
  Closed = "closed",
  Open = "open",
  Minimized = "minimized",
}

/**
 * Holds ONLY presentation status + which workout to load + lightweight meta for the
 * mini-bar. The heavy state (draft, per-second timer, autosave) stays in
 * useTemplateWorkoutBuilderPage — the host stays mounted, so there is nothing to lift.
 * `title`/`startedAt` change rarely (not per-second), so keeping them here does not
 * cause re-render storms; the mini-bar derives its own 1s tick from `startedAt`.
 */
export interface ActiveWorkoutState {
  status: WorkoutSheetStatus;
  workoutId: number | null;
  templateId: number | null;
  isStarting: boolean;
  title: string;
  startedAt?: string;

  /**
   * Exercises an accepted AI suggestion is handing to the live session. The builder drains this
   * into its draft and autosave persists them — appending them server-side instead would be wiped
   * by the builder's next autosave, which writes its whole draft over the workout.
   */
  pendingProposalExercises: AIProposalExerciseModel[];
  enqueueProposalExercises: (exercises: AIProposalExerciseModel[]) => void;
  takeProposalExercises: () => AIProposalExerciseModel[];

  openNewWorkout: () => void;
  openExistingWorkout: (workoutId: number) => void;
  startFromTemplate: (templateId: number) => void;
  setStartedWorkoutId: (workoutId: number) => void;
  setStartFailed: () => void;
  setSessionMeta: (meta: { title: string; startedAt?: string }) => void;
  minimize: () => void;
  expand: () => void;
  close: () => void;
  restoreMinimized: (workoutId: number) => void;
}

type ActiveWorkoutIdentity = Pick<
  ActiveWorkoutState,
  "workoutId" | "templateId" | "isStarting" | "title" | "startedAt"
>;

const CLEARED_IDENTITY: ActiveWorkoutIdentity = {
  workoutId: null,
  templateId: null,
  isStarting: false,
  title: "",
  startedAt: undefined,
};

export const useActiveWorkoutStore = create<ActiveWorkoutState>()((set, get) => ({
  status: WorkoutSheetStatus.Closed,
  ...CLEARED_IDENTITY,

  // Deliberately outside CLEARED_IDENTITY: the queue is filled before the sheet or the builder
  // route opens, and opening resets the identity.
  pendingProposalExercises: [],

  enqueueProposalExercises: (exercises) =>
    set((state) => ({
      pendingProposalExercises: [...state.pendingProposalExercises, ...exercises],
    })),

  takeProposalExercises: () => {
    const queued = get().pendingProposalExercises;
    if (queued.length > 0) {
      set({ pendingProposalExercises: [] });
    }

    return queued;
  },

  // One-active-workout invariant: while a session exists, the open actions only
  // expand it — they never clobber the current identity.
  openNewWorkout: () =>
    set((state) =>
      state.status !== WorkoutSheetStatus.Closed
        ? { status: WorkoutSheetStatus.Open }
        : { status: WorkoutSheetStatus.Open, ...CLEARED_IDENTITY },
    ),

  openExistingWorkout: (workoutId) =>
    set((state) =>
      state.status !== WorkoutSheetStatus.Closed
        ? { status: WorkoutSheetStatus.Open }
        : { status: WorkoutSheetStatus.Open, ...CLEARED_IDENTITY, workoutId },
    ),

  startFromTemplate: () =>
    set((state) =>
      state.status !== WorkoutSheetStatus.Closed
        ? { status: WorkoutSheetStatus.Open }
        : { status: WorkoutSheetStatus.Open, ...CLEARED_IDENTITY, isStarting: true },
    ),

  setStartedWorkoutId: (workoutId) =>
    set({ workoutId, templateId: null, isStarting: false }),

  setStartFailed: () => set({ status: WorkoutSheetStatus.Closed, ...CLEARED_IDENTITY }),

  setSessionMeta: ({ title, startedAt }) => set({ title, startedAt }),

  minimize: () =>
    set((state) =>
      state.status === WorkoutSheetStatus.Open ? { status: WorkoutSheetStatus.Minimized } : {},
    ),

  expand: () =>
    set((state) =>
      state.status !== WorkoutSheetStatus.Closed ? { status: WorkoutSheetStatus.Open } : {},
    ),

  // Anything still queued belongs to the session being closed, so it goes with it.
  close: () =>
    set({ status: WorkoutSheetStatus.Closed, ...CLEARED_IDENTITY, pendingProposalExercises: [] }),

  restoreMinimized: (workoutId) =>
    set((state) =>
      state.status === WorkoutSheetStatus.Closed
        ? { status: WorkoutSheetStatus.Minimized, ...CLEARED_IDENTITY, workoutId }
        : {},
    ),
}));

/** Narrow selectors — subscribe to these, never the whole store. */
export const selectActiveWorkoutStatus = (state: ActiveWorkoutState): WorkoutSheetStatus =>
  state.status;
export const selectIsActiveWorkout = (state: ActiveWorkoutState): boolean =>
  state.status !== WorkoutSheetStatus.Closed;
export const selectIsMinimized = (state: ActiveWorkoutState): boolean =>
  state.status === WorkoutSheetStatus.Minimized;
/** A workout that has ACTUALLY been started (timer running) — drives the blinking dumbbell. */
export const selectIsWorkoutRunning = (state: ActiveWorkoutState): boolean =>
  state.status !== WorkoutSheetStatus.Closed && Boolean(state.startedAt);

export function expandActiveWorkoutIfPresent(): boolean {
  const state = useActiveWorkoutStore.getState();
  if (state.status === WorkoutSheetStatus.Closed) {
    return false;
  }

  state.expand();
  return true;
}
