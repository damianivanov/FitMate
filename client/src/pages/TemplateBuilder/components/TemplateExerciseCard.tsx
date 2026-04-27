import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { LuChevronDown, LuEllipsis, LuGripVertical, LuPlus, LuTrash2 } from "react-icons/lu";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { ExerciseGroupType } from "@/types";
import type {
  TemplateBuilderExerciseDraftModel as TemplateExerciseDraft,
} from "../models/templateBuilderDraft";
import { QuickSetField, useTemplateBuilderStore } from "../store/templateBuilderStore";

const EXERCISE_MENU_WIDTH_PX = 208;
const EXERCISE_MENU_ESTIMATED_HEIGHT_PX = 260;
const EXERCISE_MENU_OFFSET_PX = 8;
const VIEWPORT_PADDING_PX = 8;

type ExerciseMenuPosition = { top: number; left: number };

type TemplateExerciseCardProps = {
  exercise: TemplateExerciseDraft;
  exerciseNumber: number;
  exerciseDisplayName: string;
  isDurationEnabled: boolean;
  onOpenQuickSetPopover: (
    exerciseId: string,
    setId: string,
    field: QuickSetField,
    anchorElement: HTMLElement,
  ) => void;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  setDragHandleRef?: (element: HTMLElement | null) => void;
  isDragging?: boolean;
  isDragOverlay?: boolean;
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

function getCompactSetValueText(value: number | undefined): string {
  if (value === undefined) {
    return "-";
  }

  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");
}

export function TemplateExerciseCard({
  exercise,
  exerciseNumber,
  exerciseDisplayName,
  isDurationEnabled,
  onOpenQuickSetPopover,
  dragHandleProps,
  setDragHandleRef,
  isDragging = false,
  isDragOverlay = false,
}: TemplateExerciseCardProps) {
  const setExerciseMetricMode = useTemplateBuilderStore((state) => state.setExerciseMetricMode);
  const toggleExerciseCollapse = useTemplateBuilderStore((state) => state.toggleExerciseCollapse);
  const setExerciseGrouping = useTemplateBuilderStore((state) => state.setExerciseGrouping);
  const removeExercise = useTemplateBuilderStore((state) => state.removeExercise);
  const setExerciseNotes = useTemplateBuilderStore((state) => state.setExerciseNotes);
  const addExerciseSet = useTemplateBuilderStore((state) => state.addExerciseSet);
  const removeExerciseSet = useTemplateBuilderStore((state) => state.removeExerciseSet);

  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<ExerciseMenuPosition | null>(null);
  const [isExerciseMenuOpen, setIsExerciseMenuOpen] = useState(false);
  const isMobileViewport = useIsMobileViewport({ defaultValue: true });
  const [isNotesVisible, setIsNotesVisible] = useState(() => exercise.notes.trim().length > 0);

  const noteButtonText = isNotesVisible
    ? "Hide Note"
    : exercise.notes.trim().length > 0
      ? "Edit Note"
      : "Add Note";

  const isCollapseEnabled = isMobileViewport;
  const isCollapsed = isCollapseEnabled && exercise.collapsed;
  const canCreateExerciseGroup = exercise.groupId == null || exercise.groupType === ExerciseGroupType.Straight;

  const handleRepsMetricClick = () => {
    setExerciseMetricMode(exercise.id, true);
  };

  const handleDurationMetricClick = () => {
    setExerciseMetricMode(exercise.id, false);
  };

  const handleExerciseMenuToggleClick = () => {
    if (isDragOverlay) {
      return;
    }

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
    if (!isCollapseEnabled) {
      return;
    }

    handleExerciseMenuClose();
    toggleExerciseCollapse(exercise.id);
  };

  const handleExerciseGroupingMenuClick = () => {
    if (!canCreateExerciseGroup) {
      return;
    }

    if (isCollapsed) {
      toggleExerciseCollapse(exercise.id);
    }

    setExerciseGrouping(exercise.id, ExerciseGroupType.Superset);
    handleExerciseMenuClose();
  };

  const handleExerciseDeleteClick = () => {
    handleExerciseMenuClose();
    removeExercise(exercise.id);
  };

  const handleExerciseNotesInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setExerciseNotes(exercise.id, event.target.value);
  };

  const handleAddSetClick = () => {
    addExerciseSet(exercise.id);
  };

  const handleDragHandleMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    handleExerciseMenuClose();
    dragHandleProps?.onMouseDown?.(event);
  };

  const handleDragHandleTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
    handleExerciseMenuClose();
    dragHandleProps?.onTouchStart?.(event);
  };

  const handleDragHandleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    handleExerciseMenuClose();
    dragHandleProps?.onKeyDown?.(event);
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
    const resolvedLeft = Math.min(
      maxLeft,
      Math.max(VIEWPORT_PADDING_PX, triggerRect.right - EXERCISE_MENU_WIDTH_PX),
    );
    const shouldOpenUp =
      triggerRect.bottom + EXERCISE_MENU_OFFSET_PX + EXERCISE_MENU_ESTIMATED_HEIGHT_PX
        > window.innerHeight - VIEWPORT_PADDING_PX
      && triggerRect.top - EXERCISE_MENU_OFFSET_PX - EXERCISE_MENU_ESTIMATED_HEIGHT_PX
        >= VIEWPORT_PADDING_PX;

    setMenuPosition({
      top: shouldOpenUp
        ? triggerRect.top - EXERCISE_MENU_OFFSET_PX - EXERCISE_MENU_ESTIMATED_HEIGHT_PX
        : triggerRect.bottom + EXERCISE_MENU_OFFSET_PX,
      left: resolvedLeft,
    });
  }, []);

  useEffect(() => {
    if (!isExerciseMenuOpen) {
      return;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isExerciseMenuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isExerciseMenuOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuTriggerRef.current?.contains(target) && !menuPanelRef.current?.contains(target)) {
        setIsExerciseMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, [isExerciseMenuOpen]);

  const exerciseMenu =
    isExerciseMenuOpen && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuPanelRef}
            className="liquid-user-menu fixed z-420 w-52 rounded-2xl p-2"
            style={{ top: menuPosition.top, left: menuPosition.left }}
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
            {canCreateExerciseGroup ? (
              <button
                type="button"
                onClick={handleExerciseGroupingMenuClick}
                className={["mt-1", menuActionClassName, "text-secondary hover:bg-white/8"].join(" ")}
              >
                <span>Create Superset</span>
              </button>
            ) : null}
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
        aria-hidden={isDragOverlay ? true : undefined}
        className={[
          "liquid-panel w-full rounded-3xl transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out",
          "md:w-86 md:shrink-0",
          isDragOverlay ? "liquid-drag-overlay opacity-100" : "",
          isDragging && !isDragOverlay ? "opacity-25" : "opacity-100",
        ].join(" ")}
      >
        <div className={`px-3 py-2.5 md:px-4 md:py-3 ${!isCollapsed ? "liquid-divider border-b" : ""}`}>
          <div className="flex items-center">
            <button
              type="button"
              ref={(element) => setDragHandleRef?.(element)}
              {...dragHandleProps}
              onMouseDown={handleDragHandleMouseDown}
              onTouchStart={handleDragHandleTouchStart}
              onKeyDown={handleDragHandleKeyDown}
              className="mr-2 inline-flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-full text-muted transition hover:bg-white/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:cursor-grabbing"
              aria-label={`Drag to reorder ${exerciseDisplayName}`}
            >
              <LuGripVertical className="h-5 w-5" />
            </button>
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
              className="shrink-0 cursor-pointer rounded-full border-none bg-transparent p-1.5 text-secondary transition hover:bg-red-100/20 hover:text-primary md:hidden"
              aria-label={isCollapsed ? "Expand exercise card" : "Collapse exercise card"}
            >
              <LuChevronDown className={`h-5 w-5 transition-transform ${isCollapsed ? "rotate-0" : "rotate-180"}`} />
            </button>
          </div>
        </div>

        {!isCollapsed ? (
          <div className="space-y-2 px-3 pb-3 pt-2.5 md:px-4 md:pb-4 md:pt-3">
            {isNotesVisible ? (
              <input
                value={exercise.notes}
                onChange={handleExerciseNotesInputChange}
                placeholder="Notes..."
                className="liquid-input mb-4 w-full rounded-xl px-3 py-2 text-xs md:text-sm"
              />
            ) : null}

            <div className="flex items-center justify-between gap-2 px-1 pt-1 text-2xs font-semibold uppercase tracking-widest text-muted sm:px-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="mono w-6 shrink-0 whitespace-nowrap text-center text-2xs font-semibold" />
                <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 sm:gap-2">
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
              <span className="flex h-8 w-8 shrink-0 items-center justify-center" />
            </div>

            <div className="space-y-1">
              {exercise.sets.map((setItem, setIndex) => {
                const setNumber = setIndex + 1;

                const handleWeightClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
                  onOpenQuickSetPopover(exercise.id, setItem.id, QuickSetField.WeightKg, event.currentTarget);
                };

                const handleDurationClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
                  onOpenQuickSetPopover(exercise.id, setItem.id, QuickSetField.DurationSeconds, event.currentTarget);
                };

                const handleRepsClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
                  onOpenQuickSetPopover(exercise.id, setItem.id, QuickSetField.Reps, event.currentTarget);
                };

                const handleRestClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
                  onOpenQuickSetPopover(exercise.id, setItem.id, QuickSetField.RestSeconds, event.currentTarget);
                };

                const handleRemoveClick = () => {
                  removeExerciseSet(exercise.id, setItem.id);
                };

                return (
                  <div key={setItem.id} className="flex items-center justify-between gap-2 py-1 sm:py-1.5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className={`mono inline-block w-6 shrink-0 origin-center whitespace-nowrap text-center text-2xs font-semibold text-primary ${getSetIndexScaleClassName(setNumber)}`}>
                        #{setNumber}
                      </span>
                      <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 sm:gap-2">
                        <button
                          type="button"
                          onClick={handleWeightClick}
                          className="liquid-input w-full cursor-pointer rounded-md px-1 py-2 text-center text-xs font-semibold tabular-nums sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm"
                          aria-label={`Set weight for set ${setNumber}`}
                        >
                          {getCompactSetValueText(setItem.weightKg)}
                        </button>
                        <button
                          type="button"
                          onClick={isDurationEnabled ? handleDurationClick : handleRepsClick}
                          className="liquid-input w-full cursor-pointer rounded-md px-1 py-2 text-center text-xs font-semibold tabular-nums sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm"
                          aria-label={`Set ${isDurationEnabled ? "duration" : "reps"} for set ${setNumber}`}
                        >
                          {getCompactSetValueText(isDurationEnabled ? setItem.durationSeconds : setItem.reps)}
                        </button>
                        <button
                          type="button"
                          onClick={handleRestClick}
                          className="liquid-input w-full cursor-pointer rounded-md px-1 py-2 text-center text-xs font-semibold tabular-nums text-secondary sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm"
                          aria-label={`Set rest for set ${setNumber}`}
                        >
                          {getCompactSetValueText(setItem.restSeconds)}
                        </button>
                      </div>
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                      <button
                        type="button"
                        onClick={handleRemoveClick}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-danger transition hover:bg-red-100/20 hover:text-danger sm:h-8 sm:w-8"
                        aria-label={`Remove set ${setNumber}`}
                      >
                        <LuTrash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddSetClick}
              className="mt-3 flex w-full cursor-pointer items-center justify-center rounded-xl border border-(--glass-divider) border-dashed bg-(--glass-bg-soft) p-1 text-green-400 transition hover:bg-green-100/20 hover:text-green-300 sm:px-2 sm:py-1.5"
              aria-label="Add set"
            >
              <LuPlus className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </article>
      {exerciseMenu}
    </>
  );
}
