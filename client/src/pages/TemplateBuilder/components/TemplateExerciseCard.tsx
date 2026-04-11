import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { LuChevronDown, LuEllipsis, LuGripVertical, LuPlus, LuTrash2 } from "react-icons/lu";
import { SegmentControl, type SegmentControlOption } from "@/shared/components";
import { ExerciseGroupType } from "@/types";
import { DurationSetPickerPopover } from "./DurationSetPickerPopover";
import { RepsSetPickerPopover } from "./RepsSetPickerPopover";
import { WeightSetPickerPopover } from "./WeightSetPickerPopover";
import type {
  TemplateBuilderExerciseDraftModel as TemplateExerciseDraft,
  TemplateSetNumericField,
  TemplateSetNumericValue,
} from "../models/templateBuilderDraft";

const ARRANGEMENT_SEGMENT_OPTIONS: ReadonlyArray<SegmentControlOption<ExerciseGroupType>> = [
  { value: ExerciseGroupType.Straight, label: "Single" },
  { value: ExerciseGroupType.Superset, label: "Superset" },
  { value: ExerciseGroupType.Circuit, label: "Circuit" },
];
const SET_TABLE_HEADER_CLASS_NAME =
  "flex items-center justify-between gap-2 px-1 pt-1 text-2xs font-semibold uppercase tracking-widest text-muted sm:px-2";
const SET_TABLE_ROW_CLASS_NAME =
  "flex gap-2 items-center justify-between py-1 sm:py-1.5";
const SET_TABLE_INPUT_GROUP_CLASS_NAME =
  "grid min-w-0 flex-1 grid-cols-3 gap-1 sm:gap-2";
const SET_TABLE_CONTENT_CLASS_NAME =
  "flex min-w-0 flex-1 items-center gap-2";
const SET_TABLE_INDEX_SLOT_CLASS_NAME =
  "mono w-6 shrink-0 text-center text-2xs font-semibold whitespace-nowrap";
const SET_TABLE_REMOVE_SLOT_CLASS_NAME =
  "flex h-8 w-8 shrink-0 items-center justify-center";
const ADD_SET_BUTTON_CLASS_NAME =
  "mt-3 flex w-full cursor-pointer items-center justify-center rounded-xl border border-(--glass-divider) border-dashed bg-(--glass-bg-soft) p-1 text-green-400 transition hover:bg-green-100/20 hover:text-green-300 sm:px-2 sm:py-1.5";
const EXERCISE_MENU_WIDTH_PX = 208;
const EXERCISE_MENU_ESTIMATED_HEIGHT_PX = 260;
const EXERCISE_MENU_OFFSET_PX = 8;
const VIEWPORT_PADDING_PX = 8;

export type QuickSetField = Extract<TemplateSetNumericField, "weightKg" | "reps" | "durationSeconds" | "restSeconds">;

export type TemplateExerciseCardAction =
  | {
      type: "toggleCollapse";
      exerciseId: string;
    }
  | {
      type: "setMetricMode";
      exerciseId: string;
      isWeightedExercise: boolean;
    }
  | {
      type: "changeArrangement";
      exerciseId: string;
      value: ExerciseGroupType;
    }
  | {
      type: "removeExercise";
      exerciseId: string;
    }
  | {
      type: "changeNotes";
      exerciseId: string;
      value: string;
    }
  | {
      type: "openQuickSetPopover";
      exerciseId: string;
      setId: string;
      field: QuickSetField;
      anchorElement: HTMLElement;
    }
  | {
      type: "closeQuickSetPopover";
    }
  | {
      type: "changeQuickSetValue";
      exerciseId: string;
      setId: string;
      field: QuickSetField;
      value: number;
    }
  | {
      type: "applyQuickSetValueToAll";
      exerciseId: string;
      field: QuickSetField;
      value: number;
    }
  | {
      type: "removeSet";
      exerciseId: string;
      setId: string;
    }
  | {
      type: "addSet";
      exerciseId: string;
    };

type ExerciseMenuPosition = {
  top: number;
  left: number;
};

type TemplateExerciseCardProps = {
  exercise: TemplateExerciseDraft;
  exerciseNumber: number;
  exerciseDisplayName: string;
  isGroupColumn?: boolean;
  isDurationEnabled: boolean;
  quickSetPopoverAnchorElement: HTMLElement | null;
  getCompactSetValueText: (value: TemplateSetNumericValue) => string;
  isQuickSetPopoverOpen: (exerciseId: string, setId: string, field: QuickSetField) => boolean;
  onAction: (action: TemplateExerciseCardAction) => void;
};

function getMetricButtonClass(isActive: boolean): string {
  return isActive
    ? "cursor-pointer text-primary transition"
    : "cursor-pointer text-muted transition hover:text-secondary";
}

function getSetIndexScaleClassName(setNumber: number): string {
  if (setNumber >= 100) {
    return "scale-75";
  }

  if (setNumber >= 10) {
    return "scale-90";
  }

  return "scale-100";
}

export function TemplateExerciseCard({
  exercise,
  exerciseNumber,
  exerciseDisplayName,
  isGroupColumn = false,
  isDurationEnabled,
  quickSetPopoverAnchorElement,
  getCompactSetValueText,
  isQuickSetPopoverOpen,
  onAction,
}: TemplateExerciseCardProps) {
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<ExerciseMenuPosition | null>(null);
  const [isExerciseMenuOpen, setIsExerciseMenuOpen] = useState(false);
  const [isNotesVisible, setIsNotesVisible] = useState(() => exercise.notes.trim().length > 0);
  const [isArrangementSelectorVisible, setIsArrangementSelectorVisible] = useState(false);
  const noteButtonText = isNotesVisible
    ? "Hide Note"
    : exercise.notes.trim().length > 0
      ? "Edit Note"
      : "Add Note";

  const handleRepsMetricClick = () => {
    onAction({
      type: "setMetricMode",
      exerciseId: exercise.id,
      isWeightedExercise: true,
    });
  };
  const handleDurationMetricClick = () => {
    onAction({
      type: "setMetricMode",
      exerciseId: exercise.id,
      isWeightedExercise: false,
    });
  };
  const handleExerciseMenuToggleClick = () => {
    setIsExerciseMenuOpen((previous) => !previous);
  };
  const handleExerciseMenuClose = () => {
    setIsExerciseMenuOpen(false);
  };
  const handleExerciseNotesMenuClick = () => {
    setIsNotesVisible((previous) => !previous);
    handleExerciseMenuClose();
  };
  const handleExerciseCollapseClick = () => {
    handleExerciseMenuClose();
    onAction({
      type: "toggleCollapse",
      exerciseId: exercise.id,
    });
  };
  const handleArrangementSegmentChange = (value: ExerciseGroupType) => {
    onAction({
      type: "changeArrangement",
      exerciseId: exercise.id,
      value,
    });
  };
  const handleExerciseArrangementMenuClick = () => {
    setIsArrangementSelectorVisible((previous) => {
      const shouldShowArrangementSelector = !previous;
      if (shouldShowArrangementSelector && exercise.collapsed) {
        onAction({
          type: "toggleCollapse",
          exerciseId: exercise.id,
        });
      }
      return shouldShowArrangementSelector;
    });
    handleExerciseMenuClose();
  };
  const handleExerciseDeleteClick = () => {
    handleExerciseMenuClose();
    onAction({
      type: "removeExercise",
      exerciseId: exercise.id,
    });
  };
  const handleExerciseNotesInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onAction({
      type: "changeNotes",
      exerciseId: exercise.id,
      value: event.target.value,
    });
  };
  const handleQuickSetPopoverClose = () => {
    onAction({
      type: "closeQuickSetPopover",
    });
  };
  const handleAddSetClick = () => {
    onAction({
      type: "addSet",
      exerciseId: exercise.id,
    });
  };
  const menuActionClassName =
    "flex w-full cursor-pointer items-center justify-start gap-2 rounded-full bg-transparent px-3 py-2 text-left text-sm font-semibold transition-colors";

  const updateMenuPosition = useCallback(() => {
    if (!menuTriggerRef.current) {
      return;
    }

    const triggerRect = menuTriggerRef.current.getBoundingClientRect();
    const maxLeft = Math.max(
      VIEWPORT_PADDING_PX,
      window.innerWidth - EXERCISE_MENU_WIDTH_PX - VIEWPORT_PADDING_PX,
    );
    const preferredLeft = triggerRect.right - EXERCISE_MENU_WIDTH_PX;
    const resolvedLeft = Math.min(maxLeft, Math.max(VIEWPORT_PADDING_PX, preferredLeft));
    const shouldOpenUp =
      triggerRect.bottom + EXERCISE_MENU_OFFSET_PX + EXERCISE_MENU_ESTIMATED_HEIGHT_PX
        > window.innerHeight - VIEWPORT_PADDING_PX
      && triggerRect.top - EXERCISE_MENU_OFFSET_PX - EXERCISE_MENU_ESTIMATED_HEIGHT_PX
        >= VIEWPORT_PADDING_PX;
    const resolvedTop = shouldOpenUp
      ? triggerRect.top - EXERCISE_MENU_OFFSET_PX - EXERCISE_MENU_ESTIMATED_HEIGHT_PX
      : triggerRect.bottom + EXERCISE_MENU_OFFSET_PX;

    setMenuPosition({
      top: resolvedTop,
      left: resolvedLeft,
    });
  }, []);

  useEffect(() => {
    if (!isExerciseMenuOpen) {
      return;
    }

    updateMenuPosition();
    const handleViewportChange = () => {
      updateMenuPosition();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isExerciseMenuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isExerciseMenuOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideTrigger = menuTriggerRef.current?.contains(target) ?? false;
      const isInsidePanel = menuPanelRef.current?.contains(target) ?? false;

      if (!isInsideTrigger && !isInsidePanel) {
        setIsExerciseMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [isExerciseMenuOpen]);

  const exerciseMenu = isExerciseMenuOpen
    && menuPosition
    && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={menuPanelRef}
          className="liquid-user-menu fixed z-420 w-52 rounded-2xl p-2"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
          }}
        >
          <button
            type="button"
            onClick={handleExerciseNotesMenuClick}
            className={[
              menuActionClassName,
              isNotesVisible
                ? "bg-primary-100 text-primary-900 hover:bg-primary-100"
                : "text-secondary hover:bg-white/8",
            ].join(" ")}
          >
            <span style={{ wordSpacing: "0.25rem" }}>{noteButtonText}</span>
          </button>
          <button
            type="button"
            onClick={handleExerciseArrangementMenuClick}
            className={[
              "mt-1",
              menuActionClassName,
              isArrangementSelectorVisible
                ? "bg-primary-100 text-primary-900 hover:bg-primary-100"
                : "text-secondary hover:bg-white/8",
            ].join(" ")}
          >
            <span style={{ wordSpacing: "0.25rem" }}>Change arrangement</span>
          </button>
          <button
            type="button"
            onClick={handleExerciseDeleteClick}
            className={["mt-2", menuActionClassName, "text-danger hover:bg-red-100/20"].join(" ")}
          >
            <LuTrash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <article
        className={
          isGroupColumn
            ? "liquid-panel w-full rounded-3xl md:w-80 md:max-w-80 md:shrink-0"
            : "liquid-panel w-full rounded-3xl sm:flex-1 sm:min-w-80 sm:max-w-96"
        }
      >
        <div
          className={[
            "px-3 py-2.5 md:px-4 md:py-3",
            !exercise.collapsed ? "liquid-divider border-b" : "",
          ].join(" ")}
        >
          <div className="flex items-center">
            <span className="mr-2 text-muted">
              <LuGripVertical className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex flex-1 items-center gap-1.5 text-sm">
              <span className="mono shrink-0 font-bold text-primary">{exerciseNumber}</span>
              <span className="truncate font-semibold text-foreground">{exerciseDisplayName}</span>
            </div>

            <div className="relative shrink-0">
              <button
                ref={menuTriggerRef}
                type="button"
                onClick={handleExerciseMenuToggleClick}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-secondary transition hover:bg-white/8 hover:text-primary md:h-9 md:w-9"
                aria-label={isExerciseMenuOpen ? `Close ${exerciseDisplayName} menu` : `Open ${exerciseDisplayName} menu`}
              >
                <LuEllipsis className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleExerciseCollapseClick}
              className="shrink-0 cursor-pointer rounded-full border-none bg-transparent p-1.5 text-secondary transition hover:bg-red-100/20 hover:text-primary md:p-2"
              aria-label={exercise.collapsed ? "Expand exercise card" : "Collapse exercise card"}
            >
              <LuChevronDown
                className={[
                  "h-5 w-5 transition-transform",
                  exercise.collapsed ? "rotate-0" : "rotate-180",
                ].join(" ")}
              />
            </button>
          </div>
        </div>

        {!exercise.collapsed ? (
          <div className="space-y-2 px-3 pb-3 pt-2.5 md:px-4 md:pb-4 md:pt-3">
            {isNotesVisible ? (
              <input
                value={exercise.notes}
                onChange={handleExerciseNotesInputChange}
                placeholder="Notes..."
                className="liquid-input mb-4 w-full rounded-xl px-3 py-1.5 text-xs md:text-sm"
              />
            ) : null}
            {isArrangementSelectorVisible ? (
              <SegmentControl
                className="mb-3 w-full"
                value={exercise.groupType}
                options={ARRANGEMENT_SEGMENT_OPTIONS}
                onChange={handleArrangementSegmentChange}
              />
            ) : null}

            <div className={SET_TABLE_HEADER_CLASS_NAME}>
              <div className={SET_TABLE_CONTENT_CLASS_NAME}>
                <span className={[SET_TABLE_INDEX_SLOT_CLASS_NAME, "text-muted"].join(" ")}></span>
                <div className={SET_TABLE_INPUT_GROUP_CLASS_NAME}>
                  <span className="block w-full text-center text-secondary">Weight</span>
                  <div className="flex w-full items-center justify-center gap-1 text-center">
                    <button
                      type="button"
                      onClick={handleRepsMetricClick}
                      className={getMetricButtonClass(!isDurationEnabled)}
                      aria-label="Use reps metric"
                    >
                      Reps
                    </button>
                    <span className="text-muted">/</span>
                    <button
                      type="button"
                      onClick={handleDurationMetricClick}
                      className={getMetricButtonClass(isDurationEnabled)}
                      aria-label="Use duration metric"
                    >
                      Duration
                    </button>
                  </div>
                  <span className="block w-full text-center text-secondary">Rest</span>
                </div>
              </div>
              <span className={SET_TABLE_REMOVE_SLOT_CLASS_NAME} />
            </div>

            <div className="space-y-1">
              {exercise.sets.map((setItem, setIndex) => {
                const setNumber = setIndex + 1;
                const isWeightPopoverOpen = isQuickSetPopoverOpen(exercise.id, setItem.id, "weightKg");
                const isDurationPopoverOpen = isQuickSetPopoverOpen(exercise.id, setItem.id, "durationSeconds");
                const isRepsPopoverOpen = isQuickSetPopoverOpen(exercise.id, setItem.id, "reps");
                const isRestPopoverOpen = isQuickSetPopoverOpen(exercise.id, setItem.id, "restSeconds");
                const handleWeightQuickSetClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
                  onAction({
                    type: "openQuickSetPopover",
                    exerciseId: exercise.id,
                    setId: setItem.id,
                    field: "weightKg",
                    anchorElement: event.currentTarget,
                  });
                };
                const handleDurationQuickSetClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
                  onAction({
                    type: "openQuickSetPopover",
                    exerciseId: exercise.id,
                    setId: setItem.id,
                    field: "durationSeconds",
                    anchorElement: event.currentTarget,
                  });
                };
                const handleRepsQuickSetClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
                  onAction({
                    type: "openQuickSetPopover",
                    exerciseId: exercise.id,
                    setId: setItem.id,
                    field: "reps",
                    anchorElement: event.currentTarget,
                  });
                };
                const handleRestQuickSetClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
                  onAction({
                    type: "openQuickSetPopover",
                    exerciseId: exercise.id,
                    setId: setItem.id,
                    field: "restSeconds",
                    anchorElement: event.currentTarget,
                  });
                };
                const handleWeightChange = (value: number) => {
                  onAction({
                    type: "changeQuickSetValue",
                    exerciseId: exercise.id,
                    setId: setItem.id,
                    field: "weightKg",
                    value,
                  });
                };
                const handleWeightApplyToAll = (value: number) => {
                  onAction({
                    type: "applyQuickSetValueToAll",
                    exerciseId: exercise.id,
                    field: "weightKg",
                    value,
                  });
                };
                const handleDurationChange = (value: number) => {
                  onAction({
                    type: "changeQuickSetValue",
                    exerciseId: exercise.id,
                    setId: setItem.id,
                    field: "durationSeconds",
                    value,
                  });
                };
                const handleDurationApplyToAll = (value: number) => {
                  onAction({
                    type: "applyQuickSetValueToAll",
                    exerciseId: exercise.id,
                    field: "durationSeconds",
                    value,
                  });
                };
                const handleRepsChange = (value: number) => {
                  onAction({
                    type: "changeQuickSetValue",
                    exerciseId: exercise.id,
                    setId: setItem.id,
                    field: "reps",
                    value,
                  });
                };
                const handleRepsApplyToAll = (value: number) => {
                  onAction({
                    type: "applyQuickSetValueToAll",
                    exerciseId: exercise.id,
                    field: "reps",
                    value,
                  });
                };
                const handleRestChange = (value: number) => {
                  onAction({
                    type: "changeQuickSetValue",
                    exerciseId: exercise.id,
                    setId: setItem.id,
                    field: "restSeconds",
                    value,
                  });
                };
                const handleRestApplyToAll = (value: number) => {
                  onAction({
                    type: "applyQuickSetValueToAll",
                    exerciseId: exercise.id,
                    field: "restSeconds",
                    value,
                  });
                };
                const handleRemoveSetClick = () => {
                  onAction({
                    type: "removeSet",
                    exerciseId: exercise.id,
                    setId: setItem.id,
                  });
                };

                return (
                  <div key={setItem.id}>
                    <div className={SET_TABLE_ROW_CLASS_NAME}>
                      <div className={SET_TABLE_CONTENT_CLASS_NAME}>
                        <span
                          className={[
                            SET_TABLE_INDEX_SLOT_CLASS_NAME,
                            "inline-block origin-center text-primary",
                            getSetIndexScaleClassName(setNumber),
                          ].join(" ")}
                        >
                          #{setNumber}
                        </span>
                        <div className={SET_TABLE_INPUT_GROUP_CLASS_NAME}>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={handleWeightQuickSetClick}
                              className="liquid-input w-full cursor-pointer rounded-md px-1 py-1 text-center text-xs font-semibold tabular-nums sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm"
                              aria-label={`Set weight for set ${setNumber}`}
                            >
                              {getCompactSetValueText(setItem.weightKg)}
                            </button>
                            {isWeightPopoverOpen ? (
                              <WeightSetPickerPopover
                                isOpen={isWeightPopoverOpen}
                                value={setItem.weightKg}
                                onChange={handleWeightChange}
                                onApplyToAll={handleWeightApplyToAll}
                                onClose={handleQuickSetPopoverClose}
                                quickIncrements={[1.25, 5, 10, 15, 20] as const}
                                anchorElement={quickSetPopoverAnchorElement}
                              />
                            ) : null}
                          </div>

                          <div className="relative">
                            {isDurationEnabled ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleDurationQuickSetClick}
                                  className="liquid-input w-full cursor-pointer rounded-md px-1 py-1 text-center text-xs font-semibold tabular-nums sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm"
                                  aria-label={`Set duration for set ${setNumber}`}
                                >
                                  {getCompactSetValueText(setItem.durationSeconds)}
                                </button>
                                {isDurationPopoverOpen ? (
                                  <DurationSetPickerPopover
                                    isOpen={isDurationPopoverOpen}
                                    value={setItem.durationSeconds}
                                    onChange={handleDurationChange}
                                    onApplyToAll={handleDurationApplyToAll}
                                    onClose={handleQuickSetPopoverClose}
                                    anchorElement={quickSetPopoverAnchorElement}
                                  />
                                ) : null}
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={handleRepsQuickSetClick}
                                  className="liquid-input w-full cursor-pointer rounded-md px-1 py-1 text-center text-xs font-semibold tabular-nums sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm"
                                  aria-label={`Set reps for set ${setNumber}`}
                                >
                                  {getCompactSetValueText(setItem.reps)}
                                </button>
                                {isRepsPopoverOpen ? (
                                  <RepsSetPickerPopover
                                    isOpen={isRepsPopoverOpen}
                                    value={setItem.reps}
                                    onChange={handleRepsChange}
                                    onApplyToAll={handleRepsApplyToAll}
                                    onClose={handleQuickSetPopoverClose}
                                    anchorElement={quickSetPopoverAnchorElement}
                                  />
                                ) : null}
                              </>
                            )}
                          </div>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={handleRestQuickSetClick}
                              className="liquid-input w-full cursor-pointer rounded-md px-1 py-1 text-center text-xs font-semibold tabular-nums text-secondary sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm"
                              aria-label={`Set rest for set ${setNumber}`}
                            >
                              {getCompactSetValueText(setItem.restSeconds)}
                            </button>
                            {isRestPopoverOpen ? (
                              <DurationSetPickerPopover
                                isOpen={isRestPopoverOpen}
                                title="Rest"
                                value={setItem.restSeconds}
                                onChange={handleRestChange}
                                onApplyToAll={handleRestApplyToAll}
                                onClose={handleQuickSetPopoverClose}
                                anchorElement={quickSetPopoverAnchorElement}
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className={SET_TABLE_REMOVE_SLOT_CLASS_NAME}>
                        <button
                          type="button"
                          onClick={handleRemoveSetClick}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-danger transition hover:bg-red-100/20 hover:text-danger sm:h-8 sm:w-8"
                          aria-label={`Remove set ${setNumber}`}
                        >
                          <LuTrash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddSetClick}
              className={ADD_SET_BUTTON_CLASS_NAME}
              aria-label="Add set"
            >
              <span className="flex items-center justify-center">
                <LuPlus className="h-5 w-5" />
              </span>
            </button>
          </div>
        ) : null}
      </article>
      {exerciseMenu}
    </>
  );
}
