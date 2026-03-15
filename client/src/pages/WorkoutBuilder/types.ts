import { ExerciseSetType } from "@/types";
import type { ExerciseLookupModel, PreviousExerciseSetModel } from "@/types";

export type WorkoutSetDraft = {
  id: string;
  setType: ExerciseSetType;
  weightKg: string;
  reps: string;
  notes: string;
};

export type WorkoutExerciseDraft = {
  id: string;
  selectedExercise: ExerciseLookupModel | null;
  notes: string;
  sets: WorkoutSetDraft[];
  previousSets: PreviousExerciseSetModel[];
  previousWorkoutLabel: string | null;
  isLoadingPrevious: boolean;
  previousLoadError: string | null;
  lookupSearch: string;
  muscleGroupFilterId: string;
};

export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createWorkoutSetDraft(overrides: Partial<WorkoutSetDraft> = {}): WorkoutSetDraft {
  return {
    id: createLocalId("set"),
    setType: ExerciseSetType.Working,
    weightKg: "",
    reps: "",
    notes: "",
    ...overrides,
  };
}

export function createWorkoutExerciseDraft(): WorkoutExerciseDraft {
  return {
    id: createLocalId("exercise"),
    selectedExercise: null,
    notes: "",
    sets: [createWorkoutSetDraft()],
    previousSets: [],
    previousWorkoutLabel: null,
    isLoadingPrevious: false,
    previousLoadError: null,
    lookupSearch: "",
    muscleGroupFilterId: "",
  };
}
