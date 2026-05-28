import type { ExerciseGroupType, ExerciseSetType, PreviousExerciseSet } from "@/types";

export type QuickSetFieldKey = "weightKg" | "reps" | "durationSeconds" | "restSeconds";

export interface ExerciseBuilderSetVM {
  id: string;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  restSeconds?: number;
  setType?: ExerciseSetType;
  isCompleted?: boolean;
  previousSet?: PreviousExerciseSet;
}

export interface ExerciseBuilderExerciseVM {
  id: string;
  exerciseId: number;
  displayName: string;
  groupId: number | null;
  groupType: ExerciseGroupType;
  notes: string;
  collapsed: boolean;
  isDurationEnabled: boolean;
  sets: ExerciseBuilderSetVM[];
}

export interface ExerciseBuilderCapabilities {
  showRestColumn: boolean;
  showCompletionCheckbox: boolean;
  showSetTypeDropdown: boolean;
  showPreviousColumn: boolean;
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
  onExerciseMetricModeChange: (exerciseId: string, isDurationEnabled: boolean) => void;
  onExerciseGroupingChange: (exerciseId: string, groupType: ExerciseGroupType) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onAddSet: (exerciseId: string) => void;
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
  onSetTypeChange?: (exerciseId: string, setId: string, setType: ExerciseSetType) => void;
}
