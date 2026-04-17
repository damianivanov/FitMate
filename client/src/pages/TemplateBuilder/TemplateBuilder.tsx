import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { exerciseService } from "@/services/exerciseService";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import { SegmentControl, type SegmentControlOption } from "@/shared/components";
import {
  ExerciseGroupType,
  type ExerciseLookupModel,
  type WorkoutTemplateModel,
} from "@/types";
import {
  LuArrowLeft,
  LuChevronDown,
  LuLayers,
  LuPlus,
  LuRepeat,
} from "react-icons/lu";
import {
  type TemplateBuilderExerciseDraftModel as TemplateExerciseDraft,
  type TemplateBuilderExerciseIndexItem,
  type TemplateBuilderSetDraftModel as TemplateSetDraft,
  type TemplateSetNumericField,
  type TemplateSetNumericValue,
  cloneTemplateBuilderExercises,
  createTemplateBuilderExerciseIndexItem,
  filterTemplateBuilderExerciseIndex,
  upsertTemplateBuilderExerciseIndex,
} from "./models/templateBuilderDraft";
import { AddExerciseModal, type AddExerciseModalFeedback } from "./components/AddExerciseModal";
import { DurationSetPickerPopover } from "./components/DurationSetPickerPopover";
import { RepsSetPickerPopover } from "./components/RepsSetPickerPopover";
import {
  TemplateExerciseCard,
  type QuickSetField,
  type TemplateExerciseCardAction,
} from "./components/TemplateExerciseCard";
import { TemplateBuilderSidebar } from "./components/TemplateBuilderSidebar";
import { WeightSetPickerPopover } from "./components/WeightSetPickerPopover";
import { useTemplateDraft, type HandleRestoreTemplateDraft } from "./hooks/useTemplateDraft";
import { validateTemplatePayload } from "./utils/validateTemplatePayload";

type DurationSliderStyle = CSSProperties & {
  "--duration-slider-progress": string;
};

const VISIBILITY_OPTIONS: ReadonlyArray<SegmentControlOption<boolean>> = [
  { value: false, label: "Private" },
  { value: true, label: "Public" },
];

// Колко време да стои съобщението за добавяне/премахване на упражнение (в милисекунди).
const ADD_EXERCISE_FEEDBACK_DURATION_MS = 2000;
// Интервалът за автоматично записване на черновата в local storage (в милисекунди).
const DRAFT_AUTOSAVE_INTERVAL_MS = 5000;
// Минималната стойност на слайдера за продължителност на шаблона (в минути).
const DURATION_MIN_MINUTES = 10;
// Максималната стойност на слайдера за продължителност на шаблона (в минути).
const DURATION_MAX_MINUTES = 180;
// Минималният брой редове за textarea полето с описание.
const TEMPLATE_DESCRIPTION_MIN_ROWS = 2;
// Максималният брой редове за textarea полето с описание.
const TEMPLATE_DESCRIPTION_MAX_ROWS = 6;
const DRAFT_RESTORED_TOAST_ID = "template-builder-draft-restored";

const INITIAL_EXERCISES: TemplateExerciseDraft[] = [];
type QuickSetPopoverState = {
  exerciseId: string;
  setId: string;
  field: QuickSetField;
};

type GroupAddContext = {
  insertAfterExerciseId: string;
  groupType: ExerciseGroupType;
};

type GroupedExerciseType = ExerciseGroupType.Superset | ExerciseGroupType.Circuit;

type ExerciseRenderItem = {
  exercise: TemplateExerciseDraft;
  exerciseIndex: number;
};

type ExerciseRenderBlock =
  | {
      kind: "single";
      item: ExerciseRenderItem;
    }
  | {
      kind: "group";
      groupType: GroupedExerciseType;
      items: ExerciseRenderItem[];
    };

function cloneExerciseList(exercises: TemplateExerciseDraft[]): TemplateExerciseDraft[] {
  return cloneTemplateBuilderExercises(exercises);
}

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
    notes: "",
  };
}

function createTemplateExerciseFromLookup(exercise: ExerciseLookupModel): TemplateExerciseDraft {
  return {
    id: createLocalId("template-exercise"),
    exerciseId: exercise.id,
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

function isGroupedExerciseType(groupType: ExerciseGroupType): groupType is GroupedExerciseType {
  return groupType === ExerciseGroupType.Superset || groupType === ExerciseGroupType.Circuit;
}

function buildExerciseRenderBlocks(exercises: readonly TemplateExerciseDraft[]): ExerciseRenderBlock[] {
  const blocks: ExerciseRenderBlock[] = [];
  let currentIndex = 0;

  while (currentIndex < exercises.length) {
    const currentExercise = exercises[currentIndex];
    if (!isGroupedExerciseType(currentExercise.groupType)) {
      blocks.push({
        kind: "single",
        item: {
          exercise: currentExercise,
          exerciseIndex: currentIndex,
        },
      });
      currentIndex += 1;
      continue;
    }

    const groupType = currentExercise.groupType;
    const groupedItems: ExerciseRenderItem[] = [];
    let groupedIndex = currentIndex;

    while (groupedIndex < exercises.length && exercises[groupedIndex].groupType === groupType) {
      groupedItems.push({
        exercise: exercises[groupedIndex],
        exerciseIndex: groupedIndex,
      });
      groupedIndex += 1;
    }

    blocks.push({
      kind: "group",
      groupType,
      items: groupedItems,
    });
    currentIndex = groupedIndex;
  }

  return blocks;
}

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isPublic, setIsPublic] = useState(false);
  const [exercises, setExercises] = useState<TemplateExerciseDraft[]>(cloneExerciseList(INITIAL_EXERCISES));
  const [exerciseIndex, setExerciseIndex] = useState<TemplateBuilderExerciseIndexItem[]>([]);
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [lastSavedTemplate, setLastSavedTemplate] = useState<WorkoutTemplateModel | null>(null);
  const [addExerciseFeedback, setAddExerciseFeedback] = useState<AddExerciseModalFeedback | null>(null);
  const [quickSetPopover, setQuickSetPopover] = useState<QuickSetPopoverState | null>(null);
  const [quickSetPopoverAnchorElement, setQuickSetPopoverAnchorElement] = useState<HTMLElement | null>(null);
  const [groupAddContext, setGroupAddContext] = useState<GroupAddContext | null>(null);
  const [durationEnabledExerciseIds, setDurationEnabledExerciseIds] = useState<Set<string>>(() => new Set());
  const [isBuilderCollapsed, setIsBuilderCollapsed] = useState(false);

  const selectedExerciseIds = useMemo(
    () => exercises.map((exercise) => exercise.exerciseId),
    [exercises],
  );
  const exerciseRenderBlocks = useMemo(
    () => buildExerciseRenderBlocks(exercises),
    [exercises],
  );
  const exerciseIndexById = useMemo(
    () => new Map(exerciseIndex.map((item) => [item.id, item] as const)),
    [exerciseIndex],
  );
  const draftContentFingerprint = useMemo(
    () =>
      JSON.stringify({
        name: templateName,
        description: templateDescription,
        estimatedDurationMinutes: durationMinutes,
        isPublic,
        exercises,
        exerciseIndex,
      }),
    [durationMinutes, exerciseIndex, exercises, isPublic, templateDescription, templateName],
  );
  const draftContent = useMemo(
    () => ({
      name: templateName,
      description: templateDescription,
      estimatedDurationMinutes: durationMinutes,
      isPublic,
      exercises: cloneExerciseList(exercises),
      exerciseIndex: [...exerciseIndex],
    }),
    [durationMinutes, exerciseIndex, exercises, isPublic, templateDescription, templateName],
  );
  const handleRestoreDraft = useCallback<HandleRestoreTemplateDraft>(
    async (restoredDraft, isCancelled) => {
      const restoredExercises = cloneExerciseList(restoredDraft.exercises);
      if (isCancelled()) {
        return;
      }

      setTemplateName(restoredDraft.name);
      setTemplateDescription(restoredDraft.description);
      setDurationMinutes(restoredDraft.estimatedDurationMinutes);
      setIsPublic(restoredDraft.isPublic);
      setExercises(restoredExercises);
      setDurationEnabledExerciseIds(
        new Set(
          restoredExercises
            .filter((exercise) =>
              exercise.sets.some((setItem) => setItem.durationSeconds !== undefined),
            )
            .map((exercise) => exercise.id),
        ),
      );
      setExerciseIndex(restoredDraft.exerciseIndex);
      toast.success("Restored unsaved template draft.", { id: DRAFT_RESTORED_TOAST_ID });

      const restoredExerciseIds = Array.from(
        new Set(
          restoredExercises
            .map((exercise) => exercise.exerciseId)
            .filter((exerciseId) => exerciseId > 0),
        ),
      );

      if (!restoredExerciseIds.length) {
        return;
      }

      try {
        const response = await exerciseService.getByIds(restoredExerciseIds);
        if (isCancelled()) {
          return;
        }

        const result = response.data;
        if (!result.success || !result.data || !result.data.length) {
          return;
        }

        const refreshedIndexItems = result.data.map((exerciseLookup) =>
          createTemplateBuilderExerciseIndexItem(exerciseLookup),
        );
        setExerciseIndex((previous) =>
          upsertTemplateBuilderExerciseIndex(previous, refreshedIndexItems),
        );
      } catch {
        // Keep local draft index data if lookup hydration fails.
      }
    },
    [],
  );
  const {
    markCurrentDraftAsSaved,
    resetDraft,
  } = useTemplateDraft({
    draftContent,
    draftContentFingerprint,
    onRestoreDraft: handleRestoreDraft,
    autosaveIntervalMs: DRAFT_AUTOSAVE_INTERVAL_MS,
  });
  const activeQuickSetPopoverContext = useMemo(() => {
    if (!quickSetPopover) {
      return null;
    }

    const activeExercise = exercises.find((exercise) => exercise.id === quickSetPopover.exerciseId);
    if (!activeExercise) {
      return null;
    }

    const activeSet = activeExercise.sets.find((setItem) => setItem.id === quickSetPopover.setId);
    if (!activeSet) {
      return null;
    }

    return {
      field: quickSetPopover.field,
      exerciseId: activeExercise.id,
      setId: activeSet.id,
      set: activeSet,
    };
  }, [exercises, quickSetPopover]);
  const durationProgressPercent = useMemo(() => {
    const durationRange = DURATION_MAX_MINUTES - DURATION_MIN_MINUTES;
    if (durationRange <= 0) {
      return 0;
    }

    return ((durationMinutes - DURATION_MIN_MINUTES) / durationRange) * 100;
  }, [durationMinutes]);
  const durationSliderStyle = useMemo<DurationSliderStyle>(
    () => ({
      "--duration-slider-progress": `${durationProgressPercent}%`,
    }),
    [durationProgressPercent],
  );
  const templateDescriptionRows = useMemo(() => {
    const lineCount = templateDescription.split(/\r\n|\r|\n/).length;
    return Math.min(TEMPLATE_DESCRIPTION_MAX_ROWS, Math.max(TEMPLATE_DESCRIPTION_MIN_ROWS, lineCount));
  }, [templateDescription]);

  const trimmedTemplateName = templateName.trim();
  const collapsedTemplateName = trimmedTemplateName.length > 0 ? trimmedTemplateName : "Template name...";
  const hasTemplateName = trimmedTemplateName.length > 0;

  const getExerciseDisplayName = (exerciseId: number): string =>
    exerciseIndexById.get(exerciseId)?.name ?? `Exercise #${exerciseId}`;
  const isAnyBlockingOverlayOpen = isAddExerciseModalOpen || quickSetPopover !== null;

  useEffect(() => {
    setExerciseIndex((previous) => {
      if (!previous.length) {
        return previous;
      }

      const activeExerciseIds = exercises.map((exercise) => exercise.exerciseId);
      const next = filterTemplateBuilderExerciseIndex(previous, activeExerciseIds);
      return next.length === previous.length ? previous : next;
    });
  }, [exercises]);

  useEffect(() => {
    if (!addExerciseFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAddExerciseFeedback(null);
    }, ADD_EXERCISE_FEEDBACK_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [addExerciseFeedback]);

  const handleTemplateNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTemplateName(event.target.value);
  };

  const handleTemplateDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setTemplateDescription(event.target.value);
  };

  const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDurationMinutes(Number(event.target.value));
  };

  const handleVisibilityChange = (nextVisibility: boolean) => {
    setIsPublic(nextVisibility);
  };

  const handleBuilderCollapseToggle = () => {
    setIsBuilderCollapsed((previous) => !previous);
  };

  const handleBackClick = () => {
    navigate("/templates");
  };

  const handleDiscardClick = () => {
    setTemplateName("");
    setTemplateDescription("");
    setDurationMinutes(60);
    setIsPublic(false);
    setExercises(cloneExerciseList(INITIAL_EXERCISES));
    setDurationEnabledExerciseIds(new Set());
    setExerciseIndex([]);
    setIsAddExerciseModalOpen(false);
    setGroupAddContext(null);
    setQuickSetPopover(null);
    setQuickSetPopoverAnchorElement(null);
    setLastSavedTemplate(null);
    setAddExerciseFeedback(null);
    toast.success("Template reset to initial draft.");
    resetDraft();
  };

  const handleSaveTemplateClick = async () => {
    const validationResult = validateTemplatePayload({
      templateName,
      templateDescription,
      durationMinutes,
      isPublic,
      exercises,
      durationEnabledExerciseIds,
      getExerciseDisplayName,
    });
    if (validationResult.error !== null) {
      toast.error(validationResult.error);
      return;
    }

    setIsSavingTemplate(true);

    try {
      const response = await workoutTemplateService.create(validationResult.payload);
      if (!response.data.success || !response.data.data) {
        toast.error(response.data.error ?? "Could not save template.");
        return;
      }

      setLastSavedTemplate(response.data.data);
      toast.success(
        `Template saved: ${response.data.data.name} (${response.data.data.exerciseCount} exercises, ${response.data.data.setCount} sets).`,
      );
      markCurrentDraftAsSaved({ clearPersistedDraft: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save template.";
      toast.error(message);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleAddExerciseToArrangement = (exerciseId: string, arrangement: ExerciseGroupType) => {
    if (arrangement === ExerciseGroupType.Straight) {
      return;
    }

    setAddExerciseFeedback(null);
    setGroupAddContext({
      insertAfterExerciseId: exerciseId,
      groupType: arrangement,
    });
    setIsAddExerciseModalOpen(true);
  };

  const handleSetFieldChange = (
    exerciseId: string,
    setId: string,
    field: TemplateSetNumericField,
    value: TemplateSetNumericValue,
  ) => {
    setExercises((previous) =>
      previous.map((exercise) => {
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
              : setItem,
          ),
        };
      }),
    );
  };

  const closeQuickSetPopover = () => {
    setQuickSetPopover(null);
    setQuickSetPopoverAnchorElement(null);
  };
  useEffect(() => {
    if (!quickSetPopover || activeQuickSetPopoverContext) {
      return;
    }

    setQuickSetPopover(null);
    setQuickSetPopoverAnchorElement(null);
  }, [activeQuickSetPopoverContext, quickSetPopover]);
  const handleQuickSetPopoverClose = () => {
    closeQuickSetPopover();
  };
  const handleQuickSetValueChange = (value: number) => {
    if (!activeQuickSetPopoverContext) {
      return;
    }

    handleSetFieldChange(
      activeQuickSetPopoverContext.exerciseId,
      activeQuickSetPopoverContext.setId,
      activeQuickSetPopoverContext.field,
      value,
    );
  };
  const handleQuickSetApplyToAll = (value: number) => {
    if (!activeQuickSetPopoverContext) {
      return;
    }

    setExercises((previous) =>
      previous.map((exercise) =>
        exercise.id === activeQuickSetPopoverContext.exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((setItem) => ({
                ...setItem,
                [activeQuickSetPopoverContext.field]: value,
              })),
            }
          : exercise,
      ),
    );
  };

  const handleExerciseCardAction = (action: TemplateExerciseCardAction) => {
    switch (action.type) {
      case "toggleCollapse": {
        setExercises((previous) =>
          previous.map((exercise) =>
            exercise.id === action.exerciseId
              ? {
                  ...exercise,
                  collapsed: !exercise.collapsed,
                }
              : exercise,
          ),
        );
        return;
      }
      case "changeNotes": {
        setExercises((previous) =>
          previous.map((exercise) =>
            exercise.id === action.exerciseId
              ? {
                  ...exercise,
                  notes: action.value,
                }
              : exercise,
          ),
        );
        return;
      }
      case "changeArrangement": {
        setExercises((previous) =>
          previous.map((exercise) =>
            exercise.id === action.exerciseId
              ? {
                  ...exercise,
                  groupType: action.value,
                }
              : exercise,
          ),
        );
        return;
      }
      case "setMetricMode": {
        setDurationEnabledExerciseIds((previous) => {
          const next = new Set(previous);
          const isDurationEnabled = next.has(action.exerciseId);
          const shouldEnableDuration = !action.isWeightedExercise;

          if (shouldEnableDuration) {
            next.add(action.exerciseId);
          } else {
            next.delete(action.exerciseId);
          }

          if (
            shouldEnableDuration !== isDurationEnabled
            && quickSetPopover?.exerciseId === action.exerciseId
            && (
              (shouldEnableDuration && quickSetPopover.field === "reps")
              || (!shouldEnableDuration && quickSetPopover.field === "durationSeconds")
            )
          ) {
            closeQuickSetPopover();
          }

          return next;
        });
        return;
      }
      case "removeExercise": {
        if (quickSetPopover?.exerciseId === action.exerciseId) {
          closeQuickSetPopover();
        }
        setGroupAddContext((previous) =>
          previous?.insertAfterExerciseId === action.exerciseId
            ? null
            : previous,
        );
        setDurationEnabledExerciseIds((previous) => {
          if (!previous.has(action.exerciseId)) {
            return previous;
          }

          const next = new Set(previous);
          next.delete(action.exerciseId);
          return next;
        });
        setExercises((previous) => previous.filter((exercise) => exercise.id !== action.exerciseId));
        return;
      }
      case "openQuickSetPopover": {
        setQuickSetPopover({
          exerciseId: action.exerciseId,
          setId: action.setId,
          field: action.field,
        });
        setQuickSetPopoverAnchorElement(action.anchorElement);
        return;
      }
      case "removeSet": {
        if (quickSetPopover?.exerciseId === action.exerciseId && quickSetPopover.setId === action.setId) {
          closeQuickSetPopover();
        }
        setExercises((previous) =>
          previous.map((exercise) => {
            if (exercise.id !== action.exerciseId) {
              return exercise;
            }

            if (exercise.sets.length <= 1) {
              return exercise;
            }

            return {
              ...exercise,
              sets: exercise.sets.filter((setItem) => setItem.id !== action.setId),
            };
          }),
        );
        return;
      }
      case "addSet": {
        setExercises((previous) =>
          previous.map((exercise) => {
            if (exercise.id !== action.exerciseId) {
              return exercise;
            }

            return {
              ...exercise,
              sets: [...exercise.sets, createDefaultSet()],
            };
          }),
        );
        return;
      }
    }
  };

  const handleOpenAddExerciseModal = () => {
    setAddExerciseFeedback(null);
    setGroupAddContext(null);
    setIsAddExerciseModalOpen(true);
  };

  const handleCloseAddExerciseModal = () => {
    setIsAddExerciseModalOpen(false);
    setGroupAddContext(null);
    setAddExerciseFeedback(null);
  };

  const handleAddLibraryExercise = (exercise: ExerciseLookupModel): boolean => {
    if (exercises.some((item) => item.exerciseId === exercise.id)) {
      setAddExerciseFeedback({
        text: `"${exercise.name}" is already in this template.`,
        tone: "error",
      });
      return false;
    }

    const nextExerciseDraft = createTemplateExerciseFromLookup(exercise);
    if (groupAddContext && groupAddContext.groupType !== ExerciseGroupType.Straight) {
      nextExerciseDraft.groupType = groupAddContext.groupType;
    }

    setExercises((previous) => {
      if (!groupAddContext) {
        return [...previous, nextExerciseDraft];
      }

      const anchorIndex = previous.findIndex((item) => item.id === groupAddContext.insertAfterExerciseId);
      if (anchorIndex < 0) {
        return [...previous, nextExerciseDraft];
      }

      const next = [...previous];
      next.splice(anchorIndex + 1, 0, nextExerciseDraft);
      return next;
    });

    if (groupAddContext) {
      setGroupAddContext((previous) =>
        previous
          ? {
              ...previous,
              insertAfterExerciseId: nextExerciseDraft.id,
            }
          : previous,
      );
    }

    setExerciseIndex((previous) =>
      upsertTemplateBuilderExerciseIndex(previous, [createTemplateBuilderExerciseIndexItem(exercise)]),
    );
    setAddExerciseFeedback({
      text: `${exercise.name} added to this template.`,
      tone: "success",
    });
    return true;
  };

  const handleRemoveLibraryExercise = (exercise: ExerciseLookupModel): boolean => {
    if (!exercises.some((item) => item.exerciseId === exercise.id)) {
      setAddExerciseFeedback({
        text: `"${exercise.name}" is not in this template.`,
        tone: "error",
      });
      return false;
    }

    setExercises((previous) => {
      const removedExerciseDraftIds = previous
        .filter((item) => item.exerciseId === exercise.id)
        .map((item) => item.id);

      if (removedExerciseDraftIds.length > 0) {
        setDurationEnabledExerciseIds((current) => {
          const next = new Set(current);
          removedExerciseDraftIds.forEach((draftId) => {
            next.delete(draftId);
          });
          return next;
        });
        setGroupAddContext((current) => (
          current && removedExerciseDraftIds.includes(current.insertAfterExerciseId)
            ? null
            : current
        ));
        if (quickSetPopover && removedExerciseDraftIds.includes(quickSetPopover.exerciseId)) {
          closeQuickSetPopover();
        }
      }

      return previous.filter((item) => item.exerciseId !== exercise.id);
    });
    setAddExerciseFeedback({
      text: `${exercise.name} removed from this template.`,
      tone: "success",
    });
    return true;
  };

  return (
    <>
      <header className="liquid-page-header px-4 py-3 md:px-8 md:py-5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleBackClick}
            className="liquid-pill flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary-700 transition md:h-10 md:gap-2 md:px-4"
          >
            <LuArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <p className="hidden flex-1 text-lg text-white md:block">
            Build reusable templates with grouped exercises and polished set cards.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscardClick}
              className="liquid-pill h-9 cursor-pointer rounded-full px-3 text-xs font-semibold text-primary-700 transition md:h-10 md:px-4 md:text-sm"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveTemplateClick}
              disabled={isSavingTemplate}
              className="liquid-primary-btn h-9 cursor-pointer rounded-full px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 md:h-10 md:px-5 md:text-sm"
            >
              {isSavingTemplate ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        {lastSavedTemplate && <p className="mt-1 text-xs text-primary-700">Created template id: {lastSavedTemplate.id}</p>}
      </header>

      <div className="liquid-scrollbar flex-1 overflow-y-auto px-3 pt-4 pb-24 md:px-8 md:pt-6 md:pb-6">
        <div className="w-full space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="min-w-0 md:space-y-4">
              {/* -- Builder metadata (collapsible) -- */}
              <div className="liquid-panel rounded-2xl p-2 md:rounded-lg md:p-5">
                <div className="grid gap-3 lg:grid-cols-1">
                  {isBuilderCollapsed ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={
                            hasTemplateName
                              ? "min-w-0 flex-1 px-1 text-sm font-semibold text-foreground truncate"
                              : "min-w-0 flex-1 px-1 text-sm font-semibold text-muted truncate"
                          }
                        >
                          {collapsedTemplateName}
                        </p>
                        <button
                          type="button"
                          onClick={handleBuilderCollapseToggle}
                          className="liquid-pill flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full"
                          aria-label={isBuilderCollapsed ? "Expand builder details" : "Collapse builder details"}
                        >
                          <LuChevronDown
                            className={[
                              "h-4 w-4 text-muted transition-transform",
                              isBuilderCollapsed ? "rotate-0" : "rotate-180",
                            ].join(" ")}
                          />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          value={templateName}
                          onChange={handleTemplateNameChange}
                          placeholder="Template name..."
                          className="liquid-input min-w-0 flex-1 rounded-xl px-3 py-2 text-sm font-medium"
                        />
                        <button
                          type="button"
                          onClick={handleBuilderCollapseToggle}
                          className="liquid-pill flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full"
                          aria-label={isBuilderCollapsed ? "Expand builder details" : "Collapse builder details"}
                        >
                          <LuChevronDown
                            className={[
                              "h-4 w-4 text-muted transition-transform",
                              isBuilderCollapsed ? "rotate-0" : "rotate-180",
                            ].join(" ")}
                          />
                        </button>
                      </div>

                      <div className="min-w-0">
                        <textarea
                          rows={templateDescriptionRows}
                          value={templateDescription}
                          onChange={handleTemplateDescriptionChange}
                          placeholder="Short description..."
                          className="liquid-input w-full resize-none rounded-xl px-3 py-2 text-sm leading-snug"
                        />
                      </div>

                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                        <div className="min-w-0 lg:w-40 xl:w-44">
                          <SegmentControl
                            className="w-full"
                            value={isPublic}
                            options={VISIBILITY_OPTIONS}
                            onChange={handleVisibilityChange}
                          />
                        </div>
                        <div className="min-w-0 lg:flex-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={DURATION_MIN_MINUTES}
                              max={DURATION_MAX_MINUTES}
                              value={durationMinutes}
                              onChange={handleDurationChange}
                              style={durationSliderStyle}
                              className="liquid-duration-slider liquid-duration-slider-compact min-w-0 flex-1"
                            />
                            <span className="liquid-primary-chip mono inline-flex min-w-14 items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
                              {durationMinutes} min
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* -- Exercises section -- */}
              <div className="py-5 md:px-2 md:py-5 mt-5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-5">
                  <div className="border-t border-gray-100/10" />
                  <div className="text-center">
                    <div className="text-sm md:text-lg  font-semibold uppercase tracking-[0.22em] text-muted">
                      Exercises
                    </div>
                    <p className="mt-0.5 max-w-3xs md:max-w-100 text-xs text-secondary">
                      Add exercises from your library and configure set targets.
                    </p>
                  </div>
                  <div className="border-t border-gray-100/10" />
                </div>
              </div>

              {/* -- Exercise cards -- */}
              <div className="flex flex-wrap items-center justify-start gap-4">
                {exerciseRenderBlocks.map((block, blockIndex) => {
                  if (block.kind === "single") {
                    const { exercise, exerciseIndex } = block.item;

                    return (
                      <TemplateExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        exerciseNumber={exerciseIndex + 1}
                        exerciseDisplayName={getExerciseDisplayName(exercise.exerciseId)}
                        isDurationEnabled={durationEnabledExerciseIds.has(exercise.id)}
                        onAction={handleExerciseCardAction}
                      />
                    );
                  }

                  const groupTypeLabel = block.groupType === ExerciseGroupType.Circuit ? "Circuit" : "Superset";
                  const GroupTypeIcon = block.groupType === ExerciseGroupType.Circuit ? LuRepeat : LuLayers;
                  const firstGroupExerciseId = block.items[0]?.exercise.id ?? `group-${blockIndex}`;
                  const addAnchorExercise = block.items[block.items.length - 1]?.exercise;
                  const groupExerciseIds = block.items.map(({ exercise }) => exercise.id);
                  const isGroupCollapsed = block.items.every(({ exercise }) => exercise.collapsed);
                  const isCompactGroupAddColumn = block.items.length > 1;
                  const handleAddGroupedExerciseClick = () => {
                    if (!addAnchorExercise) {
                      return;
                    }

                    handleAddExerciseToArrangement(addAnchorExercise.id, block.groupType);
                  };
                  const handleGroupCollapseToggleClick = () => {
                    const nextCollapsedValue = !isGroupCollapsed;
                    const groupExerciseIdSet = new Set(groupExerciseIds);

                    setExercises((previous) =>
                      previous.map((exercise) =>
                        groupExerciseIdSet.has(exercise.id)
                          ? {
                              ...exercise,
                              collapsed: nextCollapsedValue,
                            }
                          : exercise,
                      ),
                    );
                  };

                  return (
                    <article
                      key={`group-${firstGroupExerciseId}`}
                      className="liquid-panel w-full rounded-3xl p-4 md:w-auto md:max-w-full"
                    >
                      <div className="mb-2 px-1">
                        <button
                          type="button"
                          onClick={handleGroupCollapseToggleClick}
                          className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary transition hover:text-primary-400 md:hidden"
                          aria-label={isGroupCollapsed ? `Expand ${groupTypeLabel} set` : `Collapse ${groupTypeLabel} set`}
                        >
                          <GroupTypeIcon className="h-3.5 w-3.5" />
                          <span>{groupTypeLabel} Set</span>
                          <LuChevronDown
                            className={[
                              "h-3.5 w-3.5 transition-transform",
                              isGroupCollapsed ? "rotate-0" : "rotate-180",
                            ].join(" ")}
                          />
                        </button>
                        <p className="hidden items-center gap-1 text-xs font-semibold text-primary md:flex">
                          <GroupTypeIcon className="h-3.5 w-3.5" />
                          <span>{groupTypeLabel} Set</span>
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
                        <div className="flex min-w-0 flex-col gap-3 md:flex-1 md:flex-row md:flex-wrap md:items-start">
                          {block.items.map(({ exercise, exerciseIndex }) => (
                            <TemplateExerciseCard
                              key={exercise.id}
                              exercise={exercise}
                              exerciseNumber={exerciseIndex + 1}
                              exerciseDisplayName={getExerciseDisplayName(exercise.exerciseId)}
                              isGroupColumn
                              isDurationEnabled={durationEnabledExerciseIds.has(exercise.id)}
                              onAction={handleExerciseCardAction}
                            />
                          ))}
                        </div>
                        <div className="flex w-full justify-end md:w-20 md:shrink-0">
                          <button
                            type="button"
                            onClick={handleAddGroupedExerciseClick}
                            className={
                              [
                                "liquid-template-dashed flex h-12 w-full cursor-pointer md:flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-3 text-xs font-semibold text-primary-700 transition hover:text-primary md:h-full md:min-h-0 md:w-20",
                              ].join(" ")
                            }
                          >
                            <span
                              className={
                                isCompactGroupAddColumn
                                  ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-200 text-primary-700"
                                  : "inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-200 text-primary-700"
                              }
                            >
                              <LuPlus className={isCompactGroupAddColumn ? "h-3 w-3" : "h-3.5 w-3.5"} />
                            </span>
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleOpenAddExerciseModal}
                className="liquid-template-dashed hidden w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-700 transition sm:flex"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-200 text-primary-700">
                  <LuPlus className="h-3.5 w-3.5" />
                </span>
                <span>Add Exercise</span>
              </button>
            </section>

            <div className="liquid-divider border-t xl:border-t-0">
              <TemplateBuilderSidebar
                templateName={templateName}
                durationMinutes={durationMinutes}
                isPublic={isPublic}
                exercises={exercises}
                exerciseIndexById={exerciseIndexById}
                getExerciseDisplayName={getExerciseDisplayName}
              />
            </div>
          </div>
        </div>
      </div>

      {!isAnyBlockingOverlayOpen ? (
        <button
          type="button"
          onClick={handleOpenAddExerciseModal}
          className="liquid-primary-btn fixed right-5 bottom-5 z-90 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full md:hidden"
          aria-label="Add Exercise"
        >
          <LuPlus className="h-5 w-5" />
        </button>
      ) : null}

      {activeQuickSetPopoverContext && quickSetPopoverAnchorElement ? (
        <>
          {activeQuickSetPopoverContext.field === "weightKg" ? (
            <WeightSetPickerPopover
              isOpen
              value={activeQuickSetPopoverContext.set.weightKg}
              onChange={handleQuickSetValueChange}
              onApplyToAll={handleQuickSetApplyToAll}
              onClose={handleQuickSetPopoverClose}
              quickIncrements={[1.25, 5, 10, 15, 20] as const}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}
          {activeQuickSetPopoverContext.field === "durationSeconds" ? (
            <DurationSetPickerPopover
              isOpen
              value={activeQuickSetPopoverContext.set.durationSeconds}
              onChange={handleQuickSetValueChange}
              onApplyToAll={handleQuickSetApplyToAll}
              onClose={handleQuickSetPopoverClose}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}
          {activeQuickSetPopoverContext.field === "reps" ? (
            <RepsSetPickerPopover
              isOpen
              value={activeQuickSetPopoverContext.set.reps}
              onChange={handleQuickSetValueChange}
              onApplyToAll={handleQuickSetApplyToAll}
              onClose={handleQuickSetPopoverClose}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}
          {activeQuickSetPopoverContext.field === "restSeconds" ? (
            <DurationSetPickerPopover
              isOpen
              title="Rest"
              value={activeQuickSetPopoverContext.set.restSeconds}
              onChange={handleQuickSetValueChange}
              onApplyToAll={handleQuickSetApplyToAll}
              onClose={handleQuickSetPopoverClose}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}
        </>
      ) : null}

      {/* -- Add Exercise Modal -- */}
      <AddExerciseModal
        isOpen={isAddExerciseModalOpen}
        onClose={handleCloseAddExerciseModal}
        onAdd={handleAddLibraryExercise}
        onRemove={handleRemoveLibraryExercise}
        selectedExerciseIds={selectedExerciseIds}
        feedback={addExerciseFeedback}
      />
    </>
  );
}
