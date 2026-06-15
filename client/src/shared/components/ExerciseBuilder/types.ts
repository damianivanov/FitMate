import type { ExerciseGroupType, ExerciseSetType, PreviousExerciseSets } from "@/types";

export type QuickSetFieldKey =
  | "weightKg"
  | "reps"
  | "durationSeconds"
  | "restSeconds"
  | "rpe";

export type ExerciseMetricMode = "reps" | "duration";

export interface ExerciseBuilderSetVM {
  id: string;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  rpe?: number;
  restSeconds?: number;
  setType?: ExerciseSetType;
  isCompleted?: boolean;
}

export interface ExerciseBuilderExerciseVM {
  id: string;
  exerciseId: number;
  displayName: string;
  imageUrl?: string;
  groupId: number | null;
  groupType: ExerciseGroupType;
  notes: string;
  collapsed: boolean;
  metricMode: ExerciseMetricMode;
  sets: ExerciseBuilderSetVM[];
  previousSets?: PreviousExerciseSets;
}

export interface ExerciseBuilderCapabilities {
  showRestColumn: boolean;
  showRpeColumn: boolean;
  showCompletionCheckbox: boolean;
  showSetTypeDropdown: boolean;
  showPreviousSets: boolean;
  allowCollapse: boolean;
  allowExerciseDnd: boolean;
  allowSetDnd: boolean;
}

export interface ExerciseBuilderCallbacks {
  onOpenQuickSetPopover: (
    exerciseId: string,
    setId: string,
    field: QuickSetFieldKey,
    anchorElement: HTMLElement,
  ) => void;
  onExerciseNotesChange: (exerciseId: string, value: string) => void;
  onExerciseMetricModeChange: (exerciseId: string, metricMode: ExerciseMetricMode) => void;
  onExerciseGroupingChange: (exerciseId: string, groupType: ExerciseGroupType) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onApplyPreviousSets?: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  onAddExerciseClick: () => void;
  onAddExerciseToGroup: (
    insertAfterExerciseId: string,
    groupType: ExerciseGroupType,
    groupId: number,
  ) => void;
  onToggleExerciseCollapse?: (exerciseId: string) => void;
  onSetGroupCollapse?: (exerciseIds: string[], collapsed: boolean) => void;
  onExerciseReorder?: (activeExerciseId: string, overExerciseId: string) => void;
  onSetReorder?: (exerciseId: string, activeSetId: string, overSetId: string) => void;
  onSetCompletedToggle?: (exerciseId: string, setId: string) => void;
  onCompleteExercise?: (exerciseId: string) => void;
  onSetTypeChange?: (exerciseId: string, setId: string, setType: ExerciseSetType) => void;
}
