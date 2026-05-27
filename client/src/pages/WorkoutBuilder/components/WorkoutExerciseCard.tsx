import { useMemo, useState, type ChangeEvent } from "react";
import {
  DndContext,
  closestCenter,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LuNotebookPen, LuPlus, LuRepeat, LuSlidersHorizontal, LuTrash2 } from "react-icons/lu";
import { SortableHandleItem, useDndSensors } from "@/shared/components";
import { ExerciseGroupType, type ExerciseSetType, type PreviousExerciseSets } from "@/types";
import {
  isWorkoutExerciseDurationEnabled,
  type WorkoutExerciseDraft,
  type WorkoutSetMetricField,
} from "../utils/workoutDraft";
import { WorkoutSetRow } from "./WorkoutSetRow";

type WorkoutExerciseCardProps = {
  exercise: WorkoutExerciseDraft;
  previousSets?: PreviousExerciseSets;
  onExerciseNotesChange: (exerciseDraftId: string, value: string) => void;
  onExerciseMetricModeChange: (exerciseDraftId: string, isDurationEnabled: boolean) => void;
  onExerciseGroupingChange: (exerciseDraftId: string, groupType: ExerciseGroupType) => void;
  onRemoveExercise: (exerciseDraftId: string) => void;
  onSetTypeChange: (
    exerciseDraftId: string,
    setDraftId: string,
    setType: ExerciseSetType,
  ) => void;
  onSetCompletedToggle: (exerciseDraftId: string, setDraftId: string) => void;
  onAddSet: (exerciseDraftId: string) => void;
  onRemoveSet: (exerciseDraftId: string, setDraftId: string) => void;
  onSetReorder: (exerciseDraftId: string, activeSetId: string, overSetId: string) => void;
  onOpenQuickSetPopover: (
    exerciseDraftId: string,
    setDraftId: string,
    field: WorkoutSetMetricField,
    anchorElement: HTMLElement,
  ) => void;
  isDragging?: boolean;
  isDragOverlay?: boolean;
};

function getMetricToggleClassName(isActive: boolean): string {
  return [
    "cursor-pointer bg-transparent p-0 transition hover:text-primary",
    isActive ? "text-primary" : "text-muted",
  ].join(" ");
}

export function WorkoutExerciseCard({
  exercise,
  previousSets,
  onExerciseNotesChange,
  onExerciseMetricModeChange,
  onExerciseGroupingChange,
  onRemoveExercise,
  onSetTypeChange,
  onSetCompletedToggle,
  onAddSet,
  onRemoveSet,
  onSetReorder,
  onOpenQuickSetPopover,
  isDragging = false,
  isDragOverlay = false,
}: WorkoutExerciseCardProps) {
  const dndSensors = useDndSensors();
  const isDurationEnabled = isWorkoutExerciseDurationEnabled(exercise);
  const [activeDragSetId, setActiveDragSetId] = useState<string | null>(null);
  const [isNotesVisible, setIsNotesVisible] = useState(() => exercise.notes.trim().length > 0);
  const [isSetEditMode, setIsSetEditMode] = useState(false);
  const setIds = useMemo(
    () => exercise.sets.map((set) => set.id),
    [exercise.sets],
  );
  const setDragModifiers = useMemo(() => [restrictToVerticalAxis], []);
  const isSetDragDisabled = exercise.sets.length < 2;
  const canCreateExerciseGroup =
    exercise.clientGroupId === undefined || exercise.groupType === ExerciseGroupType.Straight;
  const noteToggleClassName = [
    "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-secondary transition hover:bg-white/8 hover:text-primary md:h-9 md:w-9",
    isNotesVisible ? "bg-primary-100 text-primary-900 hover:bg-primary-100" : "",
  ].join(" ");
  const setEditToggleClassName = [
    "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-secondary transition hover:bg-white/8 hover:text-primary md:h-9 md:w-9",
    isSetEditMode ? "bg-primary-100 text-primary ring-1 ring-primary-400 hover:bg-primary-100" : "",
  ].join(" ");

  const handleExerciseNotesChange = (event: ChangeEvent<HTMLInputElement>) => {
    onExerciseNotesChange(exercise.id, event.target.value);
  };

  const handleNotesToggleClick = () => {
    setIsNotesVisible((current) => !current);
  };

  const handleSetEditToggleClick = () => {
    setIsSetEditMode((current) => !current);
  };

  const handleRemoveExerciseClick = () => {
    onRemoveExercise(exercise.id);
  };

  const handleCreateSupersetClick = () => {
    onExerciseGroupingChange(exercise.id, ExerciseGroupType.Superset);
  };

  const handleAddSetClick = () => {
    onAddSet(exercise.id);
  };

  const handleRepsMetricClick = () => {
    onExerciseMetricModeChange(exercise.id, false);
  };

  const handleDurationMetricClick = () => {
    onExerciseMetricModeChange(exercise.id, true);
  };

  const resetSetDrag = () => {
    setActiveDragSetId(null);
  };

  const handleSetDragStart = (event: DragStartEvent) => {
    setActiveDragSetId(String(event.active.id));
  };

  const handleSetDragEnd = (event: DragEndEvent) => {
    const activeSetId = String(event.active.id);
    const overSetId = event.over ? String(event.over.id) : null;
    if (overSetId && activeSetId !== overSetId) {
      onSetReorder(exercise.id, activeSetId, overSetId);
    }

    resetSetDrag();
  };

  const handleSetDragCancel = (_event: DragCancelEvent) => {
    resetSetDrag();
  };

  return (
    <article
      aria-hidden={isDragOverlay ? true : undefined}
      className={[
        "liquid-panel w-full max-w-full rounded-3xl transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out md:shrink-0 md:rounded-2xl lg:w-120",
        isDragOverlay ? "liquid-drag-overlay opacity-100" : "",
        isDragging && !isDragOverlay ? "opacity-25" : "opacity-100",
      ].join(" ")}
    >
      <div className="liquid-divider border-b px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-extrabold text-foreground md:text-base">
              {exercise.exerciseName}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleNotesToggleClick}
              className={noteToggleClassName}
              aria-pressed={isNotesVisible}
              aria-label={isNotesVisible ? "Hide exercise notes" : "Show exercise notes"}
              title={isNotesVisible ? "Hide notes" : "Show notes"}
            >
              <LuNotebookPen className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleSetEditToggleClick}
              className={setEditToggleClassName}
              aria-pressed={isSetEditMode}
              aria-label={isSetEditMode ? "Hide set edit controls" : "Show set edit controls"}
              title={isSetEditMode ? "Hide set editing" : "Edit sets"}
            >
              <LuSlidersHorizontal className="h-4 w-4" />
            </button>

            {canCreateExerciseGroup ? (
              <button
                type="button"
                onClick={handleCreateSupersetClick}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-secondary transition hover:bg-white/8 hover:text-primary md:h-9 md:w-9"
                aria-label={`Create superset with ${exercise.exerciseName}`}
                title="Create superset"
              >
                <LuRepeat className="h-4 w-4" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleRemoveExerciseClick}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-danger transition hover:bg-(--color-danger-soft) md:h-9 md:w-9"
              aria-label={`Remove ${exercise.exerciseName}`}
              title="Remove exercise"
            >
              <LuTrash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2 px-3 pb-3 pt-3 md:px-4 md:pb-4">
        {isNotesVisible ? (
          <input
            value={exercise.notes}
            onChange={handleExerciseNotesChange}
            placeholder="Notes..."
            className="liquid-input mb-3 w-full rounded-xl px-3 py-2 text-sm"
          />
        ) : null}

        <div className="max-w-full overflow-hidden pb-1">
          <div className="min-w-0">
            <div className="flex items-end gap-1 px-1 pb-2 text-2xs font-extrabold uppercase tracking-normal text-muted md:gap-2 md:text-xs">
              {!isSetEditMode ? <span className="w-7 shrink-0" /> : null}
              {isSetEditMode ? <span className="w-20 shrink-0 text-center text-secondary">Type</span> : null}
              <div
                className={[
                  "grid min-w-0 gap-1 md:gap-2",
                  isSetEditMode ? "w-full max-w-56 grid-cols-2" : "flex-1 grid-cols-3",
                ].join(" ")}
              >
                <span className="text-center text-secondary">Wt (kg)</span>
                <span className="flex items-center justify-center gap-1 text-center">
                  <button
                    type="button"
                    onClick={handleRepsMetricClick}
                    className={getMetricToggleClassName(!isDurationEnabled)}
                    aria-label="Use reps metric"
                    aria-pressed={!isDurationEnabled}
                  >
                    Reps
                  </button>
                  <span className="text-muted">/</span>
                  <button
                    type="button"
                    onClick={handleDurationMetricClick}
                    className={getMetricToggleClassName(isDurationEnabled)}
                    aria-label="Use duration metric"
                    aria-pressed={isDurationEnabled}
                  >
                    Duration
                  </button>
                </span>
                {!isSetEditMode ? (
                  <span className="text-center text-secondary" title="Previous completed set for this exercise">
                    Last
                  </span>
                ) : null}
              </div>
              {!isSetEditMode ? <span className="w-8 shrink-0 md:w-9" /> : null}
              {isSetEditMode ? <span className="w-7 shrink-0 md:w-8" /> : null}
            </div>

            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              modifiers={setDragModifiers}
              onDragStart={handleSetDragStart}
              onDragEnd={handleSetDragEnd}
              onDragCancel={handleSetDragCancel}
            >
              <SortableContext items={setIds} strategy={verticalListSortingStrategy}>
                <div>
                  {exercise.sets.map((set, index) => (
                    <SortableHandleItem key={set.id} id={set.id} disabled={isSetEditMode || isSetDragDisabled}>
                      {({ dragHandleProps, setDragHandleRef, isDragging }) => (
                        <WorkoutSetRow
                          exerciseDraftId={exercise.id}
                          set={set}
                          setNumber={index + 1}
                          previousSet={previousSets?.sets[index]}
                          isDurationEnabled={isDurationEnabled}
                          onSetTypeChange={onSetTypeChange}
                          onSetCompletedToggle={onSetCompletedToggle}
                          onRemoveSet={onRemoveSet}
                          onOpenQuickSetPopover={onOpenQuickSetPopover}
                          dragHandleProps={dragHandleProps}
                          setDragHandleRef={setDragHandleRef}
                          isDragging={isDragging || activeDragSetId === set.id}
                          isSetEditMode={isSetEditMode}
                          isSetDragDisabled={isSetDragDisabled}
                        />
                      )}
                    </SortableHandleItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={handleAddSetClick}
              className="mt-3 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-(--glass-divider) border-dashed bg-transparent text-sm font-extrabold text-primary transition hover:bg-primary-100/20 hover:text-primary-700"
              aria-label="Add set with latest values"
              title="Add set"
            >
              <LuPlus className="h-4 w-4" />
              <span>Add Set</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
