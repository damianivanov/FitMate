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
  LuLayers,
  LuNotebookPen,
  LuPlus,
  LuSlidersHorizontal,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { SortableHandleItem, useDndSensors } from "@/shared/components/Dnd";
import { ActionMenu, type ActionMenuItem } from "../ActionMenu";
import { Modal } from "../Modal";
import { ExerciseGroupType } from "@/types";
import { ExerciseSetRow } from "./ExerciseSetRow";
import { PreviousSetsButton } from "./PreviousSetsButton";
import { getMetricGridColumnsClass } from "./format";
import type {
  ExerciseBuilderCallbacks,
  ExerciseBuilderCapabilities,
  ExerciseBuilderExerciseVM,
} from "./types";

const SET_DISPLAY_LIMIT = 3;

type ExerciseCardProps = {
  exercise: ExerciseBuilderExerciseVM;
  capabilities: ExerciseBuilderCapabilities;
  callbacks: ExerciseBuilderCallbacks;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  setDragHandleRef?: (element: HTMLElement | null) => void;
  isDragging?: boolean;
  isDragOverlay?: boolean;
  /**
   * Gates the exercise drag handle behind a reorder mode. `undefined` (desktop /
   * template builder) always shows it; when defined, it only shows while `true`.
   */
  reorderMode?: boolean;
};

export function ExerciseCard({
  exercise,
  capabilities,
  callbacks,
  dragHandleProps,
  setDragHandleRef,
  isDragging = false,
  isDragOverlay = false,
  reorderMode,
}: ExerciseCardProps) {
  const dndSensors = useDndSensors();
  const isMobileViewport = useIsMobileViewport({ defaultValue: true });

  const [isExerciseMenuOpen, setIsExerciseMenuOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
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
  // `reorderMode === false` hides the handle (reorder mode off); `undefined` keeps it always on.
  const showDragHandle = capabilities.allowExerciseDnd && reorderMode !== false;
  // The "ready" (complete-all) control sits at the front; it only yields its slot while
  // actively reordering (a mobile-only state). `undefined`/`false` reorderMode => still shown,
  // so the desktop builder (handles always on) keeps the complete button.
  const showCompleteButton = capabilities.showCompletionCheckbox && reorderMode !== true;

  const showRest = capabilities.showRestColumn;
  const showRpe = capabilities.showRpeColumn;
  const history = exercise.history;
  const showPreviousSets =
    capabilities.showPreviousSets && history != null && history.sessions.length > 0;

  const noteButtonText = isNotesVisible
    ? "Hide Note"
    : exercise.notes.trim().length > 0
      ? "Edit Note"
      : "Add Note";

  const headerGridClass = ["grid min-w-0 flex-1 gap-2 sm:gap-4", getMetricGridColumnsClass(capabilities)].join(" ");

  const handleExerciseMenuClose = useCallback(() => {
    setIsExerciseMenuOpen(false);
  }, []);

  const handleExerciseMenuOpenChange = (nextOpen: boolean) => {
    if (isDragOverlay && nextOpen) {
      return;
    }

    setIsExerciseMenuOpen(nextOpen);
  };

  const handleNotesMenuClick = () => {
    setIsNotesVisible((previous) => !previous);
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
  };

  const handleDeleteClick = () => {
    callbacks.onRemoveExercise(exercise.id);
  };

  const handleNotesInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    callbacks.onExerciseNotesChange(exercise.id, event.target.value);
  };

  const handleAddSetClick = () => {
    callbacks.onAddSet(exercise.id);
    setShowAllSets(true);
  };

  const handleMetricModeToggle = () => {
    callbacks.onExerciseMetricModeChange(exercise.id, metricMode === "duration" ? "reps" : "duration");
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

  const exerciseMenuItems: ActionMenuItem[] = [
    {
      key: "notes",
      label: noteButtonText,
      icon: <LuNotebookPen className="h-4 w-4" />,
      onSelect: handleNotesMenuClick,
      selected: isNotesVisible,
    },
  ];
  if (hasSetEditing) {
    exerciseMenuItems.push({
      key: "edit-sets",
      label: isSetEditMode ? "Done editing sets" : "Edit sets",
      icon: <LuSlidersHorizontal className="h-4 w-4" />,
      onSelect: handleSetEditToggleClick,
      selected: isSetEditMode,
    });
  }
  if (canCreateExerciseGroup) {
    exerciseMenuItems.push({
      key: "superset",
      label: "Create Superset",
      icon: <LuLayers className="h-4 w-4" />,
      onSelect: handleCreateSupersetClick,
    });
  }
  exerciseMenuItems.push({
    key: "delete",
    label: "Delete",
    icon: <LuTrash2 className="h-4 w-4" />,
    onSelect: handleDeleteClick,
    variant: "danger",
  });

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
        <div className={`py-2 pl-2 pr-3 md:py-2.5 md:pl-3 md:pr-4 ${!isCollapsed ? "liquid-divider border-b" : ""}`}>
          <div className="flex items-center gap-2">
            {showDragHandle ? (
              <button
                type="button"
                ref={(element) => setDragHandleRef?.(element)}
                {...(dragHandleProps ?? {})}
                onMouseDown={handleDragHandleMouseDown}
                onTouchStart={handleDragHandleTouchStart}
                onKeyDown={handleDragHandleKeyDown}
                className="inline-flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted transition hover:bg-white/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:cursor-grabbing"
                aria-label={`Drag to reorder ${exercise.displayName}`}
              >
                <LuGripVertical className="h-5 w-5" />
              </button>
            ) : null}
            {showCompleteButton ? (
              <button
                type="button"
                onClick={() => callbacks.onCompleteExercise?.(exercise.id)}
                className={[
                  "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition active:scale-95",
                  isExerciseCompleted
                    ? "border-success bg-success/15 text-success"
                    : "border-(--glass-divider) text-secondary hover:border-success/60 hover:text-success",
                ].join(" ")}
                aria-pressed={isExerciseCompleted}
                aria-label={
                  isExerciseCompleted
                    ? `Mark ${exercise.displayName} not done`
                    : `Mark all sets in ${exercise.displayName} done`
                }
                title={isExerciseCompleted ? "Completed — tap to undo" : "Mark all sets done"}
              >
                <LuCheck className="h-4 w-4" />
              </button>
            ) : null}
            {exercise.imageUrl ? (
              <button
                type="button"
                onClick={() => setIsImageModalOpen(true)}
                className="shrink-0 cursor-zoom-in overflow-hidden rounded-xl transition active:scale-95"
                aria-label={`View ${exercise.displayName} image`}
              >
                <img
                  src={exercise.imageUrl}
                  alt=""
                  className="h-14 w-14 object-cover"
                  loading="lazy"
                />
              </button>
            ) : null}
            {isExerciseCompleted && !showCompleteButton ? (
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
              {showPreviousSets && history ? (
                <PreviousSetsButton
                  history={history}
                  exerciseName={exercise.displayName}
                  onFastAdd={() => callbacks.onApplyPreviousSets?.(exercise.id)}
                />
              ) : null}
              <ActionMenu
                items={exerciseMenuItems}
                open={isExerciseMenuOpen}
                onOpenChange={handleExerciseMenuOpenChange}
                menuWidthClassName="w-52"
                triggerAriaLabel={`${exercise.displayName} menu`}
                triggerClassName="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-secondary transition before:absolute before:-inset-0.5 before:rounded-full before:content-[''] hover:bg-[var(--menu-item-hover-bg)] hover:text-primary"
                triggerContent={<LuEllipsis aria-hidden="true" className="h-5 w-5" />}
              />
              {isCollapseEnabled ? (
                <button
                  type="button"
                  onClick={handleCollapseClick}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-secondary transition hover:bg-white/8 hover:text-primary md:hidden"
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
                  <span className="mono w-7 shrink-0 whitespace-nowrap text-center text-2xs font-semibold" />
                  <div className={headerGridClass}>
                    <span className="block w-full text-center text-secondary">Weight</span>
                    <button
                      type="button"
                      onClick={handleMetricModeToggle}
                      className="block w-full cursor-pointer text-center text-primary transition hover:text-primary-700"
                      aria-label={`Metric: ${metricMode === "duration" ? "Time" : "Reps"}. Tap to switch.`}
                      title="Tap to switch between Reps and Time"
                    >
                      {metricMode === "duration" ? "Time" : "Reps"}
                    </button>
                    {showRest ? (
                      <span className="block w-full text-center text-secondary">Rest</span>
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
              className="mt-3 flex w-full cursor-pointer items-center justify-center rounded-xl border border-primary-300 border-dashed bg-(--glass-bg-soft) px-2 py-3 text-primary transition hover:bg-primary-100/20 hover:text-primary-700"
              aria-label="Add set"
            >
              <LuPlus className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </article>
      {exercise.imageUrl ? (
        <Modal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          maxWidth="lg"
          variant="image"
        >
          <div className="relative p-0">
            <img
              src={exercise.imageUrl}
              alt={exercise.displayName}
              className="block max-h-[80vh] w-full rounded-2xl object-contain"
            />
            <button
              type="button"
              onClick={() => setIsImageModalOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
              aria-label={`Close ${exercise.displayName} image`}
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
