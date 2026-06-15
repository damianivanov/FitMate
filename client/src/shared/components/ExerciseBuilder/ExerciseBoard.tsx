import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { LuPlus } from "react-icons/lu";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { SortableHandleItem, useDndSensors } from "@/shared/components/Dnd";
import { buildExerciseRenderBlocks, getGroupBlockId } from "./dnd";
import { ExerciseCard } from "./ExerciseCard";
import { ExerciseGroupCard } from "./ExerciseGroupCard";
import type {
  ExerciseBuilderCallbacks,
  ExerciseBuilderCapabilities,
  ExerciseBuilderExerciseVM,
} from "./types";

type ExerciseBoardProps = {
  exercises: readonly ExerciseBuilderExerciseVM[];
  capabilities: ExerciseBuilderCapabilities;
  callbacks: ExerciseBuilderCallbacks;
  isInteractionLocked: boolean;
};

export function ExerciseBoard({
  exercises,
  capabilities,
  callbacks,
  isInteractionLocked,
}: ExerciseBoardProps) {
  const dndSensors = useDndSensors();
  const isMobileViewport = useIsMobileViewport({ defaultValue: true });

  const [activeDragExerciseId, setActiveDragExerciseId] = useState<string | null>(null);
  const lastOverExerciseIdRef = useRef<string | null>(null);

  const exerciseRenderBlocks = useMemo(
    () => buildExerciseRenderBlocks(exercises),
    [exercises],
  );
  const blockSortableIds = useMemo(
    () =>
      exerciseRenderBlocks.map((block) =>
        block.kind === "single" ? block.exercise.id : getGroupBlockId(block.groupId),
      ),
    [exerciseRenderBlocks],
  );
  const exerciseSortingStrategy = isMobileViewport
    ? verticalListSortingStrategy
    : horizontalListSortingStrategy;
  const dragModifiers = useMemo(
    () => (isMobileViewport ? [restrictToVerticalAxis] : undefined),
    [isMobileViewport],
  );
  const activeDragExercise = useMemo(() => {
    if (!activeDragExerciseId) {
      return null;
    }

    return exercises.find((exercise) => exercise.id === activeDragExerciseId) ?? null;
  }, [activeDragExerciseId, exercises]);

  const handleExerciseDragStart = (event: DragStartEvent) => {
    const activeExerciseId = String(event.active.id);
    lastOverExerciseIdRef.current = activeExerciseId;
    setActiveDragExerciseId(activeExerciseId);
  };

  const handleExerciseDragOver = (event: DragOverEvent) => {
    if (!event.over) {
      return;
    }

    lastOverExerciseIdRef.current = String(event.over.id);
  };

  const resetExerciseDrag = () => {
    lastOverExerciseIdRef.current = null;
    setActiveDragExerciseId(null);
  };

  const handleExerciseDragEnd = (event: DragEndEvent) => {
    const over = event.over;
    const activeExerciseId = String(event.active.id);
    const overExerciseId =
      lastOverExerciseIdRef.current && lastOverExerciseIdRef.current !== activeExerciseId
        ? lastOverExerciseIdRef.current
        : over
          ? String(over.id)
          : lastOverExerciseIdRef.current;

    if (!overExerciseId || activeExerciseId === overExerciseId) {
      resetExerciseDrag();
      return;
    }

    callbacks.onExerciseReorder?.(activeExerciseId, overExerciseId);
    resetExerciseDrag();
  };

  const handleExerciseDragCancel = () => {
    resetExerciseDrag();
  };

  const renderExerciseCard = (exercise: ExerciseBuilderExerciseVM) => {
    if (!capabilities.allowExerciseDnd) {
      return (
        <div key={exercise.id} className="w-full md:flex md:w-auto">
          <ExerciseCard exercise={exercise} capabilities={capabilities} callbacks={callbacks} />
        </div>
      );
    }

    return (
      <SortableHandleItem
        key={exercise.id}
        id={exercise.id}
        className="w-full md:flex md:w-auto"
        disabled={isInteractionLocked}
      >
        {({ dragHandleProps, setDragHandleRef, isDragging }) => (
          <ExerciseCard
            exercise={exercise}
            capabilities={capabilities}
            callbacks={callbacks}
            dragHandleProps={dragHandleProps}
            setDragHandleRef={setDragHandleRef}
            isDragging={isDragging || activeDragExerciseId === exercise.id}
          />
        )}
      </SortableHandleItem>
    );
  };

  const boardContent = (
    <div className="flex flex-col items-stretch justify-start gap-4 md:flex-row md:flex-wrap md:items-center">
      {exerciseRenderBlocks.map((block) => {
        if (block.kind === "single") {
          return renderExerciseCard(block.exercise);
        }

        return (
          <ExerciseGroupCard
            key={`group-${block.groupId}`}
            block={block}
            capabilities={capabilities}
            callbacks={callbacks}
            isInteractionLocked={isInteractionLocked}
            isMobileViewport={isMobileViewport}
          />
        );
      })}
    </div>
  );

  return (
    <>
      {capabilities.allowExerciseDnd ? (
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          modifiers={dragModifiers}
          onDragStart={handleExerciseDragStart}
          onDragOver={handleExerciseDragOver}
          onDragEnd={handleExerciseDragEnd}
          onDragCancel={handleExerciseDragCancel}
        >
          <SortableContext items={blockSortableIds} strategy={exerciseSortingStrategy}>
            {boardContent}
          </SortableContext>
          {typeof document !== "undefined"
            ? createPortal(
                <DragOverlay
                  adjustScale={false}
                  className="pointer-events-none cursor-grabbing"
                  dropAnimation={null}
                  modifiers={dragModifiers}
                  zIndex={500}
                >
                  {activeDragExercise ? (
                    <ExerciseCard
                      exercise={activeDragExercise}
                      capabilities={capabilities}
                      callbacks={callbacks}
                      isDragOverlay
                    />
                  ) : null}
                </DragOverlay>,
                document.body,
              )
            : null}
        </DndContext>
      ) : (
        boardContent
      )}

      <button
        type="button"
        onClick={callbacks.onAddExerciseClick}
        className="liquid-template-dashed liquid-press mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-700 transition"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-200 text-primary-700">
          <LuPlus className="h-3.5 w-3.5" />
        </span>
        <span>Add Exercise</span>
      </button>
    </>
  );
}
