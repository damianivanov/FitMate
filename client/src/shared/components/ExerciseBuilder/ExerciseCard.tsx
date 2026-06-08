import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import {
  DndContext,
  closestCenter,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  LuCheck,
  LuChevronDown,
  LuEllipsis,
  LuGripVertical,
  LuPlus,
  LuSlidersHorizontal,
  LuTrash2,
} from "react-icons/lu";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { SortableHandleItem, useDndSensors } from "@/shared/components/Dnd";
import { ExerciseGroupType } from "@/types";
import { ExerciseSetRow } from "./ExerciseSetRow";
import { getMetricGridColumnsClass } from "./format";
import type {
  ExerciseBuilderCallbacks,
  ExerciseBuilderCapabilities,
  ExerciseBuilderExerciseVM,
} from "./types";

const EXERCISE_MENU_OFFSET_PX = 8;
const VIEWPORT_PADDING_PX = 8;
const SET_DISPLAY_LIMIT = 3;

type ExerciseCardProps = {
  exercise: ExerciseBuilderExerciseVM;
  capabilities: ExerciseBuilderCapabilities;
  callbacks: ExerciseBuilderCallbacks;
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

export function ExerciseCard({
  exercise,
  capabilities,
  callbacks,
  dragHandleProps,
  setDragHandleRef,
  isDragging = false,
  isDragOverlay = false,
}: ExerciseCardProps) {
  const dndSensors = useDndSensors();
  const isMobileViewport = useIsMobileViewport({ defaultValue: true });

  const [isExerciseMenuOpen, setIsExerciseMenuOpen] = useState(false);
  const [isNotesVisible, setIsNotesVisible] = useState(() => exercise.notes.trim().length > 0);
  const [isSetEditMode, setIsSetEditMode] = useState(false);
  const [showAllSets, setShowAllSets] = useState(false);
  const [activeDragSetId, setActiveDragSetId] = useState<string | null>(null);

  const hasHiddenSets = exercise.sets.length > SET_DISPLAY_LIMIT;
  const visibleSets = useMemo(
    () => (hasHiddenSets && !showAllSets ? exercise.sets.slice(0, SET_DISPLAY_LIMIT) : exercise.sets),
    [exercise.sets, hasHiddenSets, showAllSets],
  );
  const setDragModifiers = useMemo(() => [restrictToVerticalAxis], []);
  const setIds = useMemo(() => visibleSets.map((set) => set.id), [visibleSets]);
  const isSetDragDisabled = visibleSets.length < 2;

  const metricMode = exercise.metricMode;
  const hasSetEditing = capabilities.showSetTypeDropdown || capabilities.allowSetDnd;
  const isCollapseEnabled = capabilities.allowCollapse && isMobileViewport;
  const isCollapsed = isCollapseEnabled && exercise.collapsed;
  const isExerciseCompleted =
    exercise.sets.length > 0 && exercise.sets.every((set) => set.isCompleted);
  const canCreateExerciseGroup =
    exercise.groupId == null || exercise.groupType === ExerciseGroupType.Straight;

  const showRest = capabilities.showRestColumn;
  const showPrevious = capabilities.showPreviousColumn;
  const showRpe = capabilities.showRpeColumn;

  const noteButtonText = isNotesVisible
    ? "Hide Note"
    : exercise.notes.trim().length > 0
      ? "Edit Note"
      : "Add Note";

  const headerGridClass = ["grid min-w-0 flex-1 gap-2 sm:gap-4", getMetricGridColumnsClass(capabilities)].join(" ");

  // Controlled-elements floating menu: trigger and panel are tracked via state setters so
  // autoUpdate re-measures against the live trigger rect. Deleting a sibling exercise reflows
  // the list, autoUpdate fires, and the menu stays anchored instead of flashing at a stale spot.
  const [menuTriggerElement, setMenuTriggerElement] = useState<HTMLButtonElement | null>(null);
  const [menuPanelElement, setMenuPanelElement] = useState<HTMLDivElement | null>(null);
  const { floatingStyles, context, isPositioned } = useFloating({
    open: isExerciseMenuOpen,
    onOpenChange: setIsExerciseMenuOpen,
    strategy: "fixed",
    placement: "bottom-end",
    middleware: [
      offset(EXERCISE_MENU_OFFSET_PX),
      flip({ padding: VIEWPORT_PADDING_PX }),
      shift({ padding: VIEWPORT_PADDING_PX }),
    ],
    whileElementsMounted: autoUpdate,
    elements: { reference: menuTriggerElement, floating: menuPanelElement },
  });
  const exerciseMenuDismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([exerciseMenuDismiss]);

  const handleExerciseMenuClose = useCallback(() => {
    setIsExerciseMenuOpen(false);
  }, []);

  const handleExerciseMenuToggleClick = () => {
    if (isDragOverlay) {
      return;
    }

    setIsExerciseMenuOpen((previous) => !previous);
  };

  const handleNotesMenuClick = () => {
    setIsNotesVisible((previous) => !previous);
    handleExerciseMenuClose();
  };

  const handleSetEditToggleClick = () => {
    setIsSetEditMode((previous) => !previous);
  };

  const handleCollapseClick = () => {
    if (!isCollapseEnabled) {
      return;
    }

    handleExerciseMenuClose();
    callbacks.onToggleExerciseCollapse?.(exercise.id);
  };

  const handleCreateSupersetClick = () => {
    if (!canCreateExerciseGroup) {
      return;
    }

    if (isCollapsed) {
      callbacks.onToggleExerciseCollapse?.(exercise.id);
    }

    callbacks.onExerciseGroupingChange(exercise.id, ExerciseGroupType.Superset);
    handleExerciseMenuClose();
  };

  const handleDeleteClick = () => {
    handleExerciseMenuClose();
    callbacks.onRemoveExercise(exercise.id);
  };

  const handleNotesInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    callbacks.onExerciseNotesChange(exercise.id, event.target.value);
  };

  const handleAddSetClick = () => {
    callbacks.onAddSet(exercise.id);
    setShowAllSets(true);
  };

  const handleRepsMetricClick = () => {
    callbacks.onExerciseMetricModeChange(exercise.id, "reps");
  };

  const handleDurationMetricClick = () => {
    callbacks.onExerciseMetricModeChange(exercise.id, "duration");
  };

  const handleDistanceMetricClick = () => {
    callbacks.onExerciseMetricModeChange(exercise.id, "distance");
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

  const handleSetDragStart = (event: DragStartEvent) => {
    setActiveDragSetId(String(event.active.id));
  };

  const handleSetDragEnd = (event: DragEndEvent) => {
    const activeSetId = String(event.active.id);
    const overSetId = event.over ? String(event.over.id) : null;
    if (overSetId && activeSetId !== overSetId) {
      callbacks.onSetReorder?.(exercise.id, activeSetId, overSetId);
    }

    setActiveDragSetId(null);
  };

  const handleSetDragCancel = (_event: DragCancelEvent) => {
    setActiveDragSetId(null);
  };

  const menuActionClassName =
    "flex w-full cursor-pointer items-center justify-start gap-2 rounded-full bg-transparent px-3 py-2 text-left text-sm font-semibold transition-colors";

  const exerciseMenu = isExerciseMenuOpen ? (
    <FloatingPortal>
      <div
        ref={setMenuPanelElement}
        className="liquid-user-menu z-420 w-52 rounded-2xl p-2"
        style={{ ...floatingStyles, visibility: isPositioned ? "visible" : "hidden" }}
        {...getFloatingProps()}
      >
        <button
          type="button"
          onClick={handleNotesMenuClick}
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
            onClick={handleCreateSupersetClick}
            className={["mt-1", menuActionClassName, "text-secondary hover:bg-white/8"].join(" ")}
          >
            <span>Create Superset</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleDeleteClick}
          className={["mt-2", menuActionClassName, "text-danger hover:bg-red-100/20"].join(" ")}
        >
          <LuTrash2 className="h-4 w-4" />
          <span>Delete</span>
        </button>
      </div>
    </FloatingPortal>
  ) : null;

  const setRows: ReactNode = capabilities.allowSetDnd ? (
    <DndContext
      sensors={dndSensors}
      collisionDetection={closestCenter}
      modifiers={setDragModifiers}
      onDragStart={handleSetDragStart}
      onDragEnd={handleSetDragEnd}
      onDragCancel={handleSetDragCancel}
    >
      <SortableContext items={setIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {visibleSets.map((set, index) => (
            <SortableHandleItem
              key={set.id}
              id={set.id}
              disabled={isSetDragDisabled}
            >
              {({ dragHandleProps: setDragHandlePropsItem, setDragHandleRef: setSetDragHandleRef, isDragging: isSetDragging }) => (
                <ExerciseSetRow
                  exerciseId={exercise.id}
                  set={set}
                  setNumber={index + 1}
                  metricMode={metricMode}
                  capabilities={capabilities}
                  callbacks={callbacks}
                  isSetEditMode={isSetEditMode}
                  dragHandleProps={setDragHandlePropsItem}
                  setDragHandleRef={setSetDragHandleRef}
                  isDragging={isSetDragging || activeDragSetId === set.id}
                  isSetDragDisabled={isSetDragDisabled}
                />
              )}
            </SortableHandleItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  ) : (
    <div className="space-y-1">
      {visibleSets.map((set, index) => (
        <ExerciseSetRow
          key={set.id}
          exerciseId={exercise.id}
          set={set}
          setNumber={index + 1}
          metricMode={metricMode}
          capabilities={capabilities}
          callbacks={callbacks}
          isSetEditMode={isSetEditMode}
        />
      ))}
    </div>
  );

  return (
    <>
      <article
        aria-hidden={isDragOverlay ? true : undefined}
        data-exercise-id={exercise.id}
        className={[
          "liquid-panel w-full rounded-3xl transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out md:w-86 md:shrink-0",
          isDragOverlay ? "liquid-drag-overlay opacity-100" : "",
          isDragging && !isDragOverlay ? "opacity-25" : "opacity-100",
        ].join(" ")}
      >
        <div className={`px-3 py-2.5 md:px-4 md:py-3 ${!isCollapsed ? "liquid-divider border-b" : ""}`}>
          <div className="flex items-center gap-2">
            {capabilities.allowExerciseDnd ? (
              <button
                type="button"
                ref={(element) => setDragHandleRef?.(element)}
                {...(dragHandleProps ?? {})}
                onMouseDown={handleDragHandleMouseDown}
                onTouchStart={handleDragHandleTouchStart}
                onKeyDown={handleDragHandleKeyDown}
                className="inline-flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted transition hover:bg-white/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:cursor-grabbing"
                aria-label={`Drag to reorder ${exercise.displayName}`}
              >
                <LuGripVertical className="h-5 w-5" />
              </button>
            ) : null}
            {isExerciseCompleted ? (
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
                aria-hidden="true"
              >
                <LuCheck className="h-3.5 w-3.5" />
              </span>
            ) : null}
            {isCollapseEnabled ? (
              <button
                type="button"
                onClick={handleCollapseClick}
                className={`block min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-semibold ${isExerciseCompleted ? "text-muted line-through" : "text-foreground"}`}
                title={exercise.displayName}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? `Expand ${exercise.displayName}` : `Collapse ${exercise.displayName}`}
              >
                {exercise.displayName}
              </button>
            ) : (
              <span
                className={`block min-w-0 flex-1 truncate text-sm font-semibold ${isExerciseCompleted ? "text-muted line-through" : "text-foreground"}`}
                title={exercise.displayName}
              >
                {exercise.displayName}
              </span>
            )}
            <div className="flex shrink-0 items-center gap-0.5">
              {hasSetEditing ? (
                <button
                  type="button"
                  onClick={handleSetEditToggleClick}
                  className={[
                    "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-secondary transition hover:bg-white/8 hover:text-primary md:h-9 md:w-9",
                    isSetEditMode ? "bg-primary-100 text-primary ring-1 ring-primary-400 hover:bg-primary-100" : "",
                  ].join(" ")}
                  aria-pressed={isSetEditMode}
                  aria-label={isSetEditMode ? "Hide set edit controls" : "Show set edit controls"}
                  title={isSetEditMode ? "Hide set editing" : "Edit sets"}
                >
                  <LuSlidersHorizontal className="h-4 w-4" />
                </button>
              ) : null}
              <button
                ref={setMenuTriggerElement}
                type="button"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-secondary transition hover:bg-white/8 hover:text-primary md:h-9 md:w-9"
                aria-label={isExerciseMenuOpen ? `Close ${exercise.displayName} menu` : `Open ${exercise.displayName} menu`}
                {...getReferenceProps({ onClick: handleExerciseMenuToggleClick })}
              >
                <LuEllipsis className="h-5 w-5" />
              </button>
              {isCollapseEnabled ? (
                <button
                  type="button"
                  onClick={handleCollapseClick}
                  className="shrink-0 cursor-pointer rounded-full border-none bg-transparent p-1.5 text-secondary transition hover:bg-white/8 hover:text-primary md:hidden"
                  aria-label={isCollapsed ? "Expand exercise card" : "Collapse exercise card"}
                >
                  <LuChevronDown className={`h-5 w-5 transition-transform ${isCollapsed ? "rotate-0" : "rotate-180"}`} />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {!isCollapsed ? (
          <div className="space-y-2 px-3 pb-3 pt-2.5 md:px-4 md:pb-4 md:pt-3">
            {isNotesVisible ? (
              <input
                value={exercise.notes}
                onChange={handleNotesInputChange}
                placeholder="Notes..."
                className="liquid-input mb-4 w-full rounded-xl px-3 py-2 text-xs md:text-sm"
              />
            ) : null}

            <div
              className={[
                "-mb-2 flex items-center justify-between gap-2 px-1 pt-1 text-2xs font-semibold uppercase tracking-widest text-muted sm:px-2",
                isSetEditMode ? "invisible" : "",
              ].join(" ")}
              aria-hidden={isSetEditMode ? true : undefined}
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {capabilities.allowSetDnd ? (
                    <span className="w-6 shrink-0" />
                  ) : (
                    <span className="mono w-7 shrink-0 whitespace-nowrap text-center text-2xs font-semibold" />
                  )}
                  <div className={headerGridClass}>
                    <span className="block w-full text-center text-secondary">Weight</span>
                    <div className="flex w-full items-center justify-center gap-0.5 text-center">
                      <button
                        type="button"
                        onClick={handleRepsMetricClick}
                        className={getMetricButtonClass(metricMode === "reps")}
                        aria-label="Use reps metric"
                        aria-pressed={metricMode === "reps"}
                      >
                        Reps
                      </button>
                      <span className="text-muted">/</span>
                      <button
                        type="button"
                        onClick={handleDurationMetricClick}
                        className={getMetricButtonClass(metricMode === "duration")}
                        aria-label="Use duration metric"
                        aria-pressed={metricMode === "duration"}
                      >
                        Time
                      </button>
                      <span className="text-muted">/</span>
                      <button
                        type="button"
                        onClick={handleDistanceMetricClick}
                        className={getMetricButtonClass(metricMode === "distance")}
                        aria-label="Use distance metric"
                        aria-pressed={metricMode === "distance"}
                      >
                        Dist
                      </button>
                    </div>
                    {showRest ? (
                      <span className="block w-full text-center text-secondary">Rest</span>
                    ) : null}
                    {showPrevious ? (
                      <span className="block w-full text-center text-secondary" title="Previous completed set for this exercise">
                        Last
                      </span>
                    ) : null}
                    {showRpe ? (
                      <span className="block w-full text-center text-secondary" title="Rate of perceived exertion (0-10)">
                        RPE
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center md:h-9 md:w-9" />
            </div>
            {setRows}

            {hasHiddenSets ? (
              <button
                type="button"
                onClick={() => setShowAllSets((previous) => !previous)}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-secondary transition hover:text-primary"
                aria-expanded={showAllSets}
              >
                <LuChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllSets ? "rotate-180" : ""}`} />
                <span>{showAllSets ? "Show fewer sets" : `Show all ${exercise.sets.length} sets`}</span>
              </button>
            ) : (
              <div
                aria-hidden="true"
                className="invisible mt-2 flex w-full items-center justify-center gap-1 px-2 py-1 text-2xs font-semibold uppercase tracking-wide"
              >
                <LuChevronDown className="h-3.5 w-3.5" />
                <span>Show all sets</span>
              </div>
            )}

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
