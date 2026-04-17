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

const EXERCISE_MENU_WIDTH_PX = 208;
const EXERCISE_MENU_ESTIMATED_HEIGHT_PX = 260;
const EXERCISE_MENU_OFFSET_PX = 8;
const VIEWPORT_PADDING_PX = 8;

export type QuickSetField = Extract<TemplateSetNumericField, "weightKg" | "reps" | "durationSeconds" | "restSeconds">;

export type TemplateExerciseCardAction =
  | { type: "toggleCollapse"; exerciseId: string }
  | { type: "setMetricMode"; exerciseId: string; isWeightedExercise: boolean }
  | { type: "changeArrangement"; exerciseId: string; value: ExerciseGroupType }
  | { type: "removeExercise"; exerciseId: string }
  | { type: "changeNotes"; exerciseId: string; value: string }
  | { type: "openQuickSetPopover"; exerciseId: string; setId: string; field: QuickSetField; anchorElement: HTMLElement }
  | { type: "removeSet"; exerciseId: string; setId: string }
  | { type: "addSet"; exerciseId: string };

type ExerciseMenuPosition = { top: number; left: number };

type TemplateExerciseCardProps = {
  exercise: TemplateExerciseDraft;
  exerciseNumber: number;
  exerciseDisplayName: string;
  isGroupColumn?: boolean;
  isDurationEnabled: boolean;
  onAction: (action: TemplateExerciseCardAction) => void;
};

function getMetricButtonClass(isActive: boolean): string {
  return isActive
    ? "cursor-pointer text-primary transition"
    : "cursor-pointer text-muted transition hover:text-secondary";
}

function getSetIndexScaleClassName(setNumber: number): string {
  if (setNumber >= 100) return "scale-75";
  if (setNumber >= 10) return "scale-90";
  return "scale-100";
}

function getCompactSetValueText(value: TemplateSetNumericValue): string {
  if (value === undefined) return "-";
  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");
}

export function TemplateExerciseCard({
  exercise,
  exerciseNumber,
  exerciseDisplayName,
  isGroupColumn = false,
  isDurationEnabled,
  onAction,
}: TemplateExerciseCardProps) {
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<ExerciseMenuPosition | null>(null);
  const [isExerciseMenuOpen, setIsExerciseMenuOpen] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false
  );
  const [isNotesVisible, setIsNotesVisible] = useState(() => exercise.notes.trim().length > 0);
  const [isArrangementSelectorVisible, setIsArrangementSelectorVisible] = useState(false);

  const noteButtonText = isNotesVisible
    ? "Hide Note"
    : exercise.notes.trim().length > 0
      ? "Edit Note"
      : "Add Note";

  const isCollapseEnabled = !isDesktopViewport;
  const isCollapsed = isCollapseEnabled && exercise.collapsed;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktopViewport(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const handleRepsMetricClick = () => onAction({ type: "setMetricMode", exerciseId: exercise.id, isWeightedExercise: true });
  const handleDurationMetricClick = () => onAction({ type: "setMetricMode", exerciseId: exercise.id, isWeightedExercise: false });
  const handleExerciseMenuToggleClick = () => setIsExerciseMenuOpen((prev) => !prev);
  const handleExerciseMenuClose = () => setIsExerciseMenuOpen(false);

  const handleExerciseNotesMenuClick = () => {
    setIsNotesVisible((prev) => !prev);
    handleExerciseMenuClose();
  };

  const handleExerciseCollapseClick = () => {
    if (!isCollapseEnabled) return;
    handleExerciseMenuClose();
    onAction({ type: "toggleCollapse", exerciseId: exercise.id });
  };

  const handleArrangementSegmentChange = (value: ExerciseGroupType) => {
    onAction({ type: "changeArrangement", exerciseId: exercise.id, value });
  };

  const handleExerciseArrangementMenuClick = () => {
    setIsArrangementSelectorVisible((prev) => {
      if (!prev && isCollapsed) onAction({ type: "toggleCollapse", exerciseId: exercise.id });
      return !prev;
    });
    handleExerciseMenuClose();
  };

  const handleExerciseDeleteClick = () => {
    handleExerciseMenuClose();
    onAction({ type: "removeExercise", exerciseId: exercise.id });
  };

  const handleExerciseNotesInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onAction({ type: "changeNotes", exerciseId: exercise.id, value: event.target.value });
  };

  const handleAddSetClick = () => onAction({ type: "addSet", exerciseId: exercise.id });

  const menuActionClassName =
    "flex w-full cursor-pointer items-center justify-start gap-2 rounded-full bg-transparent px-3 py-2 text-left text-sm font-semibold transition-colors";

  const updateMenuPosition = useCallback(() => {
    if (!menuTriggerRef.current) return;
    const triggerRect = menuTriggerRef.current.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_PADDING_PX, window.innerWidth - EXERCISE_MENU_WIDTH_PX - VIEWPORT_PADDING_PX);
    const resolvedLeft = Math.min(maxLeft, Math.max(VIEWPORT_PADDING_PX, triggerRect.right - EXERCISE_MENU_WIDTH_PX));
    const shouldOpenUp =
      triggerRect.bottom + EXERCISE_MENU_OFFSET_PX + EXERCISE_MENU_ESTIMATED_HEIGHT_PX > window.innerHeight - VIEWPORT_PADDING_PX
      && triggerRect.top - EXERCISE_MENU_OFFSET_PX - EXERCISE_MENU_ESTIMATED_HEIGHT_PX >= VIEWPORT_PADDING_PX;
    setMenuPosition({
      top: shouldOpenUp
        ? triggerRect.top - EXERCISE_MENU_OFFSET_PX - EXERCISE_MENU_ESTIMATED_HEIGHT_PX
        : triggerRect.bottom + EXERCISE_MENU_OFFSET_PX,
      left: resolvedLeft,
    });
  }, []);

  useEffect(() => {
    if (!isExerciseMenuOpen) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isExerciseMenuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isExerciseMenuOpen) return;
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
              className={[menuActionClassName, isNotesVisible ? "bg-primary-100 text-primary-900 hover:bg-primary-100" : "text-secondary hover:bg-white/8"].join(" ")}
            >
              <span style={{ wordSpacing: "0.25rem" }}>{noteButtonText}</span>
            </button>
            <button
              type="button"
              onClick={handleExerciseArrangementMenuClick}
              className={["mt-1", menuActionClassName, isArrangementSelectorVisible ? "bg-primary-100 text-primary-900 hover:bg-primary-100" : "text-secondary hover:bg-white/8"].join(" ")}
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
      <article className={`liquid-panel w-full rounded-3xl ${isGroupColumn ? "md:w-86 md:shrink-0" : "sm:w-86 sm:shrink-0"}`}>
        <div className={`px-3 py-2.5 md:px-4 md:py-3 ${!isCollapsed ? "liquid-divider border-b" : ""}`}>
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
              className="shrink-0 cursor-pointer rounded-full border-none bg-transparent p-1.5 text-secondary transition hover:bg-red-100/20 hover:text-primary md:hidden"
              aria-label={isCollapsed ? "Expand exercise card" : "Collapse exercise card"}
            >
              <LuChevronDown className={`h-5 w-5 transition-transform ${isCollapsed ? "rotate-0" : "rotate-180"}`} />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="space-y-2 px-3 pb-3 pt-2.5 md:px-4 md:pb-4 md:pt-3">
            {isNotesVisible && (
              <input
                value={exercise.notes}
                onChange={handleExerciseNotesInputChange}
                placeholder="Notes..."
                className="liquid-input mb-4 w-full rounded-xl px-3 py-2 text-xs md:text-sm"
              />
            )}
            {isArrangementSelectorVisible && (
              <SegmentControl
                className="mb-3 w-full"
                value={exercise.groupType}
                options={ARRANGEMENT_SEGMENT_OPTIONS}
                onChange={handleArrangementSegmentChange}
              />
            )}

            <div className="flex items-center justify-between gap-2 px-1 pt-1 text-2xs font-semibold uppercase tracking-widest text-muted sm:px-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="mono w-6 shrink-0 text-center text-2xs font-semibold whitespace-nowrap" />
                <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 sm:gap-2">
                  <span className="block w-full text-center text-secondary">Weight</span>
                  <div className="flex w-full items-center justify-center gap-1 text-center">
                    <button type="button" onClick={handleRepsMetricClick} className={getMetricButtonClass(!isDurationEnabled)} aria-label="Use reps metric">
                      Reps
                    </button>
                    <span className="text-muted">/</span>
                    <button type="button" onClick={handleDurationMetricClick} className={getMetricButtonClass(isDurationEnabled)} aria-label="Use duration metric">
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

                const handleWeightClick = (e: ReactMouseEvent<HTMLButtonElement>) =>
                  onAction({ type: "openQuickSetPopover", exerciseId: exercise.id, setId: setItem.id, field: "weightKg", anchorElement: e.currentTarget });
                const handleDurationClick = (e: ReactMouseEvent<HTMLButtonElement>) =>
                  onAction({ type: "openQuickSetPopover", exerciseId: exercise.id, setId: setItem.id, field: "durationSeconds", anchorElement: e.currentTarget });
                const handleRepsClick = (e: ReactMouseEvent<HTMLButtonElement>) =>
                  onAction({ type: "openQuickSetPopover", exerciseId: exercise.id, setId: setItem.id, field: "reps", anchorElement: e.currentTarget });
                const handleRestClick = (e: ReactMouseEvent<HTMLButtonElement>) =>
                  onAction({ type: "openQuickSetPopover", exerciseId: exercise.id, setId: setItem.id, field: "restSeconds", anchorElement: e.currentTarget });
                const handleRemoveClick = () =>
                  onAction({ type: "removeSet", exerciseId: exercise.id, setId: setItem.id });

                return (
                  <div key={setItem.id} className="flex gap-2 items-center justify-between py-1 sm:py-1.5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className={`mono w-6 shrink-0 text-center text-2xs font-semibold whitespace-nowrap inline-block origin-center text-primary ${getSetIndexScaleClassName(setNumber)}`}>
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
        )}
      </article>
      {exerciseMenu}
    </>
  );
}
