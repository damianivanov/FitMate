import { create } from "zustand";
import {
  ExerciseGroupType,
  type ExerciseLookupModel,
} from "@/types";
import type {
  TemplateBuilderDraftModel,
  TemplateBuilderExerciseDraftModel as TemplateExerciseDraft,
  TemplateBuilderFeedback,
  TemplateBuilderSetDraftModel as TemplateSetDraft,
} from "../models/templateBuilderDraft";
import {
  cloneTemplateBuilderExercises,
  filterTemplateBuilderExerciseIndex,
  getNextTemplateBuilderExerciseGroupId,
  normalizeTemplateBuilderExerciseGroups,
  reorderTemplateBuilderExercisesForDrag,
  upsertTemplateBuilderExerciseIndex,
} from "../models/templateBuilderDraft";

export enum TemplateBuilderMode {
  Create = "create",
  Edit = "edit",
}

export enum QuickSetField {
  WeightKg = "weightKg",
  Reps = "reps",
  DurationSeconds = "durationSeconds",
  RestSeconds = "restSeconds",
}

export type QuickSetPopoverState = {
  exerciseId: string;
  setId: string;
  field: QuickSetField;
};

export type GroupAddContext = {
  insertAfterExerciseId: string;
  groupType: ExerciseGroupType;
  groupId: number;
};

const INITIAL_DURATION_MINUTES = 60;

function createLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultSet(): TemplateSetDraft {
  return {
    id: createLocalId("set"),
    weightKg: undefined,
    reps: 8,
    durationSeconds: undefined,
    distanceMeters: undefined,
    restSeconds: 90,
  };
}

function createTemplateExerciseFromLookup(exercise: ExerciseLookupModel): TemplateExerciseDraft {
  return {
    id: createLocalId("template-exercise"),
    exerciseId: exercise.id,
    groupId: undefined,
    groupType: ExerciseGroupType.Straight,
    notes: "",
    collapsed: false,
    sets: [
      createDefaultSet(),
      createDefaultSet(),
      createDefaultSet(),
    ],
  };
}

function collectDurationEnabledExerciseIds(exercises: readonly TemplateExerciseDraft[]): Set<string> {
  return new Set(
    exercises
      .filter((exercise) =>
        exercise.sets.some((setItem) => setItem.durationSeconds !== undefined))
      .map((exercise) => exercise.id),
  );
}

type TemplateBuilderState = {
  mode: TemplateBuilderMode;
  templateId: number | null;
  templateName: string;
  templateDescription: string;
  durationMinutes: number;
  isPublic: boolean;
  exercises: TemplateExerciseDraft[];
  exerciseIndex: ExerciseLookupModel[];
  isAddExerciseModalOpen: boolean;
  addExerciseFeedback: TemplateBuilderFeedback | null;
  quickSetPopover: QuickSetPopoverState | null;
  groupAddContext: GroupAddContext | null;
  durationEnabledExerciseIds: Set<string>;
};

type TemplateBuilderActions = {
  initializeMode: (mode: TemplateBuilderMode, templateId: number | null) => void;
  resetBuilderState: () => void;
  populateFromDraft: (draft: TemplateBuilderDraftModel) => void;
  setTemplateName: (value: string) => void;
  setTemplateDescription: (value: string) => void;
  setDurationMinutes: (value: number) => void;
  setIsPublic: (value: boolean) => void;
  setExerciseIndex: (items: ExerciseLookupModel[]) => void;
  upsertExerciseIndex: (items: ExerciseLookupModel[]) => void;
  filterExerciseIndexByActiveExercises: () => void;
  openAddExerciseModal: () => void;
  openAddExerciseModalForGroup: (exerciseId: string, groupType: ExerciseGroupType, groupId?: number) => void;
  closeAddExerciseModal: () => void;
  setAddExerciseFeedback: (feedback: TemplateBuilderFeedback | null) => void;
  addLibraryExercise: (exercise: ExerciseLookupModel) => boolean;
  removeLibraryExercise: (exercise: ExerciseLookupModel) => boolean;
  setSetFieldValue: (exerciseId: string, setId: string, field: QuickSetField, value: number) => void;
  applyFieldToAllSets: (exerciseId: string, field: QuickSetField, value: number) => void;
  toggleExerciseCollapse: (exerciseId: string) => void;
  setExerciseNotes: (exerciseId: string, value: string) => void;
  setExerciseGrouping: (exerciseId: string, value: ExerciseGroupType) => void;
  setExerciseMetricMode: (exerciseId: string, isWeightedExercise: boolean) => void;
  removeExercise: (exerciseId: string) => void;
  removeExerciseSet: (exerciseId: string, setId: string) => void;
  addExerciseSet: (exerciseId: string) => void;
  reorderExerciseSet: (exerciseId: string, activeSetId: string, overSetId: string) => void;
  openQuickSetPopover: (exerciseId: string, setId: string, field: QuickSetField) => void;
  closeQuickSetPopover: () => void;
  setGroupCollapse: (groupExerciseIds: string[], nextCollapsedValue: boolean) => void;
  endExerciseDrag: (activeExerciseId: string, overExerciseId: string) => void;
};

export type TemplateBuilderStore = TemplateBuilderState & TemplateBuilderActions;

function createInitialState(
  mode: TemplateBuilderMode,
  templateId: number | null,
): TemplateBuilderState {
  return {
    mode,
    templateId,
    templateName: "",
    templateDescription: "",
    durationMinutes: INITIAL_DURATION_MINUTES,
    isPublic: false,
    exercises: [],
    exerciseIndex: [],
    isAddExerciseModalOpen: false,
    addExerciseFeedback: null,
    quickSetPopover: null,
    groupAddContext: null,
    durationEnabledExerciseIds: new Set(),
  };
}

export const useTemplateBuilderStore = create<TemplateBuilderStore>((set, get) => ({
  ...createInitialState(TemplateBuilderMode.Create, null),

  initializeMode: (mode, templateId) => {
    set({ mode, templateId });
  },

  resetBuilderState: () => {
    const { mode, templateId } = get();
    set(createInitialState(mode, templateId));
  },

  populateFromDraft: (draft) => {
    const restoredExercises = cloneTemplateBuilderExercises(draft.exercises);
    set({
      templateName: draft.name,
      templateDescription: draft.description,
      durationMinutes: draft.estimatedDurationMinutes,
      isPublic: draft.isPublic,
      exercises: restoredExercises,
      durationEnabledExerciseIds: collectDurationEnabledExerciseIds(restoredExercises),
      exerciseIndex: [...draft.exerciseIndex],
    });
  },

  setTemplateName: (value) => {
    set({ templateName: value });
  },

  setTemplateDescription: (value) => {
    set({ templateDescription: value });
  },

  setDurationMinutes: (value) => {
    set({ durationMinutes: value });
  },

  setIsPublic: (value) => {
    set({ isPublic: value });
  },

  setExerciseIndex: (items) => {
    set({ exerciseIndex: [...items] });
  },

  upsertExerciseIndex: (items) => {
    set((state) => ({
      exerciseIndex: upsertTemplateBuilderExerciseIndex(state.exerciseIndex, items),
    }));
  },

  filterExerciseIndexByActiveExercises: () => {
    set((state) => {
      if (!state.exerciseIndex.length) {
        return state;
      }

      const activeExerciseIds = state.exercises.map((exercise) => exercise.exerciseId);
      const next = filterTemplateBuilderExerciseIndex(state.exerciseIndex, activeExerciseIds);
      if (next.length === state.exerciseIndex.length) {
        return state;
      }

      return {
        exerciseIndex: next,
      };
    });
  },

  openAddExerciseModal: () => {
    set({
      isAddExerciseModalOpen: true,
      addExerciseFeedback: null,
      groupAddContext: null,
    });
  },

  openAddExerciseModalForGroup: (exerciseId, groupType, groupId) => {
    if (groupType === ExerciseGroupType.Straight) {
      return;
    }

    const nextGroupId = groupId ?? getNextTemplateBuilderExerciseGroupId(get().exercises);
    set({
      isAddExerciseModalOpen: true,
      addExerciseFeedback: null,
      groupAddContext: {
        insertAfterExerciseId: exerciseId,
        groupType,
        groupId: nextGroupId,
      },
    });
  },

  closeAddExerciseModal: () => {
    set({
      isAddExerciseModalOpen: false,
      addExerciseFeedback: null,
      groupAddContext: null,
    });
  },

  setAddExerciseFeedback: (feedback) => {
    set({
      addExerciseFeedback: feedback,
    });
  },

  addLibraryExercise: (exercise) => {
    let wasAdded = false;

    set((state) => {
      if (state.exercises.some((item) => item.exerciseId === exercise.id)) {
        return {
          addExerciseFeedback: {
            text: `"${exercise.name}" is already in this template.`,
            tone: "error",
          },
        };
      }

      const nextExerciseDraft = createTemplateExerciseFromLookup(exercise);
      if (state.groupAddContext) {
        nextExerciseDraft.groupId = state.groupAddContext.groupId;
        nextExerciseDraft.groupType = state.groupAddContext.groupType;
      }

      let nextExercises: TemplateExerciseDraft[];
      if (!state.groupAddContext) {
        nextExercises = normalizeTemplateBuilderExerciseGroups([
          ...state.exercises,
          nextExerciseDraft,
        ]);
      } else {
        const anchorIndex = state.exercises.findIndex(
          (item) => item.id === state.groupAddContext?.insertAfterExerciseId,
        );
        if (anchorIndex < 0) {
          nextExercises = normalizeTemplateBuilderExerciseGroups([
            ...state.exercises,
            nextExerciseDraft,
          ]);
        } else {
          const draftList = [...state.exercises];
          draftList.splice(anchorIndex + 1, 0, nextExerciseDraft);
          nextExercises = normalizeTemplateBuilderExerciseGroups(draftList);
        }
      }

      wasAdded = true;

      return {
        exercises: nextExercises,
        groupAddContext: state.groupAddContext
          ? {
              ...state.groupAddContext,
              insertAfterExerciseId: nextExerciseDraft.id,
            }
          : null,
        exerciseIndex: upsertTemplateBuilderExerciseIndex(state.exerciseIndex, [exercise]),
        addExerciseFeedback: {
          text: `${exercise.name} added to this template.`,
          tone: "success",
        },
      };
    });

    return wasAdded;
  },

  removeLibraryExercise: (exercise) => {
    let wasRemoved = false;

    set((state) => {
      if (!state.exercises.some((item) => item.exerciseId === exercise.id)) {
        return {
          addExerciseFeedback: {
            text: `"${exercise.name}" is not in this template.`,
            tone: "error",
          },
        };
      }

      const removedExercises = state.exercises.filter((item) => item.exerciseId === exercise.id);
      const removedExerciseDraftIds = removedExercises.map((item) => item.id);
      const dissolvableGroupIds = new Set(
        removedExercises
          .map((item) => item.groupId)
          .filter((groupId): groupId is number => groupId != null),
      );

      const nextDurationEnabledExerciseIds = new Set(state.durationEnabledExerciseIds);
      removedExerciseDraftIds.forEach((draftId) => {
        nextDurationEnabledExerciseIds.delete(draftId);
      });

      const shouldCloseQuickSetPopover =
        state.quickSetPopover !== null
        && removedExerciseDraftIds.includes(state.quickSetPopover.exerciseId);

      wasRemoved = true;

      return {
        exercises: normalizeTemplateBuilderExerciseGroups(
          state.exercises.filter((item) => item.exerciseId !== exercise.id),
          dissolvableGroupIds,
        ),
        durationEnabledExerciseIds: nextDurationEnabledExerciseIds,
        groupAddContext:
          state.groupAddContext && removedExerciseDraftIds.includes(state.groupAddContext.insertAfterExerciseId)
            ? null
            : state.groupAddContext,
        quickSetPopover: shouldCloseQuickSetPopover ? null : state.quickSetPopover,
        addExerciseFeedback: {
          text: `${exercise.name} removed from this template.`,
          tone: "success",
        },
      };
    });

    return wasRemoved;
  },

  setSetFieldValue: (exerciseId, setId, field, value) => {
    set((state) => ({
      exercises: state.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        return {
          ...exercise,
          sets: exercise.sets.map((setItem) =>
            setItem.id === setId
              ? {
                  ...setItem,
                  [field]: value,
                }
              : setItem),
        };
      }),
    }));
  },

  applyFieldToAllSets: (exerciseId, field, value) => {
    set((state) => ({
      exercises: state.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((setItem) => ({
                ...setItem,
                [field]: value,
              })),
            }
          : exercise),
    }));
  },

  toggleExerciseCollapse: (exerciseId) => {
    set((state) => ({
      exercises: state.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              collapsed: !exercise.collapsed,
            }
          : exercise),
    }));
  },

  setExerciseNotes: (exerciseId, value) => {
    set((state) => ({
      exercises: state.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              notes: value,
            }
          : exercise),
    }));
  },

  setExerciseGrouping: (exerciseId, value) => {
    set((state) => {
      const targetExercise = state.exercises.find((exercise) => exercise.id === exerciseId);
      if (!targetExercise) {
        return state;
      }

      if (value === ExerciseGroupType.Straight) {
        const shouldFlattenGroup = typeof targetExercise.groupId === "number";
        const nextExercises = state.exercises.map((exercise) => {
          const shouldFlattenExercise = shouldFlattenGroup
            ? exercise.groupId === targetExercise.groupId
            : exercise.id === exerciseId;

          if (!shouldFlattenExercise) {
            return exercise;
          }

          return {
            ...exercise,
            groupId: undefined,
            groupType: ExerciseGroupType.Straight,
          };
        });

        return {
          exercises: normalizeTemplateBuilderExerciseGroups(
            nextExercises,
            typeof targetExercise.groupId === "number" ? new Set([targetExercise.groupId]) : undefined,
          ),
        };
      }

      if (typeof targetExercise.groupId === "number") {
        return {
          exercises: state.exercises.map((exercise) =>
            exercise.groupId === targetExercise.groupId
              ? {
                  ...exercise,
                  groupType: value,
                }
              : exercise),
        };
      }

      const nextGroupId = getNextTemplateBuilderExerciseGroupId(state.exercises);
      return {
        exercises: state.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                groupId: nextGroupId,
                groupType: value,
              }
            : exercise),
      };
    });
  },

  setExerciseMetricMode: (exerciseId, isWeightedExercise) => {
    set((state) => {
      const nextDurationEnabledExerciseIds = new Set(state.durationEnabledExerciseIds);
      const isDurationEnabled = nextDurationEnabledExerciseIds.has(exerciseId);
      const shouldEnableDuration = !isWeightedExercise;

      if (shouldEnableDuration) {
        nextDurationEnabledExerciseIds.add(exerciseId);
      } else {
        nextDurationEnabledExerciseIds.delete(exerciseId);
      }

      const shouldCloseQuickSetPopover =
        shouldEnableDuration !== isDurationEnabled
        && state.quickSetPopover?.exerciseId === exerciseId
        && (
          (shouldEnableDuration && state.quickSetPopover.field === QuickSetField.Reps)
          || (!shouldEnableDuration && state.quickSetPopover.field === QuickSetField.DurationSeconds)
        );

      return {
        durationEnabledExerciseIds: nextDurationEnabledExerciseIds,
        quickSetPopover: shouldCloseQuickSetPopover ? null : state.quickSetPopover,
      };
    });
  },

  removeExercise: (exerciseId) => {
    set((state) => {
      const removedExercise = state.exercises.find((exercise) => exercise.id === exerciseId);
      const dissolvableGroupIds =
        removedExercise?.groupId != null ? new Set([removedExercise.groupId]) : undefined;
      const shouldCloseQuickSetPopover = state.quickSetPopover?.exerciseId === exerciseId;
      const nextDurationEnabledExerciseIds = new Set(state.durationEnabledExerciseIds);
      nextDurationEnabledExerciseIds.delete(exerciseId);

      return {
        exercises: normalizeTemplateBuilderExerciseGroups(
          state.exercises.filter((exercise) => exercise.id !== exerciseId),
          dissolvableGroupIds,
        ),
        groupAddContext:
          state.groupAddContext?.insertAfterExerciseId === exerciseId
            ? null
            : state.groupAddContext,
        durationEnabledExerciseIds: nextDurationEnabledExerciseIds,
        quickSetPopover: shouldCloseQuickSetPopover ? null : state.quickSetPopover,
      };
    });
  },

  removeExerciseSet: (exerciseId, setId) => {
    set((state) => {
      const shouldCloseQuickSetPopover =
        state.quickSetPopover?.exerciseId === exerciseId
        && state.quickSetPopover.setId === setId;

      return {
        exercises: state.exercises.map((exercise) => {
          if (exercise.id !== exerciseId || exercise.sets.length <= 1) {
            return exercise;
          }

          return {
            ...exercise,
            sets: exercise.sets.filter((setItem) => setItem.id !== setId),
          };
        }),
        quickSetPopover: shouldCloseQuickSetPopover ? null : state.quickSetPopover,
      };
    });
  },

  addExerciseSet: (exerciseId) => {
    set((state) => ({
      exercises: state.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: [...exercise.sets, createDefaultSet()],
            }
          : exercise),
    }));
  },

  reorderExerciseSet: (exerciseId, activeSetId, overSetId) => {
    set((state) => ({
      exercises: state.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const activeIndex = exercise.sets.findIndex((setItem) => setItem.id === activeSetId);
        const overIndex = exercise.sets.findIndex((setItem) => setItem.id === overSetId);
        if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
          return exercise;
        }

        const nextSets = exercise.sets.slice();
        const [movedSet] = nextSets.splice(activeIndex, 1);
        if (!movedSet) {
          return exercise;
        }

        nextSets.splice(overIndex, 0, movedSet);
        return {
          ...exercise,
          sets: nextSets,
        };
      }),
    }));
  },

  openQuickSetPopover: (exerciseId, setId, field) => {
    set({
      quickSetPopover: {
        exerciseId,
        setId,
        field,
      },
    });
  },

  closeQuickSetPopover: () => {
    set({
      quickSetPopover: null,
    });
  },

  setGroupCollapse: (groupExerciseIds, nextCollapsedValue) => {
    const groupExerciseIdSet = new Set(groupExerciseIds);
    set((state) => ({
      exercises: state.exercises.map((exercise) =>
        groupExerciseIdSet.has(exercise.id)
          ? {
              ...exercise,
              collapsed: nextCollapsedValue,
            }
          : exercise),
    }));
  },

  endExerciseDrag: (activeExerciseId, overExerciseId) => {
    set((state) => {
      const nextExercises = reorderTemplateBuilderExercisesForDrag(
        state.exercises,
        activeExerciseId,
        overExerciseId,
      );

      if (nextExercises.every((exercise, index) => exercise === state.exercises[index])) {
        return state;
      }

      return {
        exercises: nextExercises,
      };
    });
  },
}));
