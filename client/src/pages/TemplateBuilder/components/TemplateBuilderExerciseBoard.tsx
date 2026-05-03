import { useMemo, useRef, useState } from "react";
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
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { LuChevronDown, LuLayers, LuPlus, LuRepeat, LuSlidersHorizontal } from "react-icons/lu";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import {
  SegmentControl,
  SortableHandleItem,
  useDndSensors,
  type SegmentControlOption,
} from "@/shared/components";
import { ExerciseGroupType } from "@/types";
import {
  getTemplateBuilderExerciseDragOrderIndexes,
  type TemplateBuilderExerciseDraftModel as TemplateExerciseDraft,
} from "../models/templateBuilderDraft";
import { useTemplateBuilderStore, type QuickSetField } from "../store/templateBuilderStore";
import { TemplateExerciseCard } from "./TemplateExerciseCard";

const GROUP_TYPE_SEGMENT_OPTIONS: ReadonlyArray<SegmentControlOption<ExerciseGroupType>> = [
  { value: ExerciseGroupType.Superset, label: "Superset" },
  { value: ExerciseGroupType.Circuit, label: "Circuit" },
  { value: ExerciseGroupType.Straight, label: "Make singles" },
];

type ExerciseRenderItem = {
  exercise: TemplateExerciseDraft;
  exerciseIndex: number;
};

type ExerciseRenderBlock =
  | {
      kind: "single";
      exercise: TemplateExerciseDraft;
      exerciseIndex: number;
    }
  | {
      kind: "group";
      groupType: ExerciseGroupType;
      groupId: number;
      items: ExerciseRenderItem[];
    };

function buildExerciseRenderBlocks(exercises: readonly TemplateExerciseDraft[]): ExerciseRenderBlock[] {
  const blocks: ExerciseRenderBlock[] = [];
  let currentIndex = 0;

  while (currentIndex < exercises.length) {
    const currentExercise = exercises[currentIndex];
    const groupId = currentExercise.groupId;
    if (groupId == null || currentExercise.groupType === ExerciseGroupType.Straight) {
      blocks.push({
        kind: "single",
        exercise: currentExercise,
        exerciseIndex: currentIndex,
      });
      currentIndex += 1;
      continue;
    }

    const groupType = currentExercise.groupType;
    const groupedItems: ExerciseRenderItem[] = [];
    while (
      currentIndex < exercises.length
      && exercises[currentIndex].groupId === groupId
      && exercises[currentIndex].groupType === groupType
    ) {
      groupedItems.push({
        exercise: exercises[currentIndex],
        exerciseIndex: currentIndex,
      });
      currentIndex += 1;
    }

    blocks.push({
      kind: "group",
      groupId,
      groupType,
      items: groupedItems,
    });
  }

  return blocks;
}

function createExerciseSortingStrategy(
  exercises: readonly TemplateExerciseDraft[],
  shouldLockHorizontalMovement: boolean,
): SortingStrategy {
  return (args) => {
    const nextIndexes = getTemplateBuilderExerciseDragOrderIndexes(
      exercises,
      args.activeIndex,
      args.overIndex,
    );
    const nextIndex = nextIndexes.indexOf(args.index);
    const oldRect = args.rects[args.index];
    const newRect = args.rects[nextIndex];
    if (!oldRect || !newRect || nextIndex === args.index) {
      return null;
    }

    return {
      x: shouldLockHorizontalMovement ? 0 : newRect.left - oldRect.left,
      y: newRect.top - oldRect.top,
      scaleX: newRect.width / oldRect.width,
      scaleY: newRect.height / oldRect.height,
    };
  };
}

type TemplateBuilderExerciseBoardProps = {
  onOpenQuickSetPopover: (
    exerciseId: string,
    setId: string,
    field: QuickSetField,
    anchorElement: HTMLElement,
  ) => void;
};

export function TemplateBuilderExerciseBoard({
  onOpenQuickSetPopover,
}: TemplateBuilderExerciseBoardProps) {
  const dndSensors = useDndSensors();
  const isMobileViewport = useIsMobileViewport({ defaultValue: true });

  const [activeDragExerciseId, setActiveDragExerciseId] = useState<string | null>(null);
  const [visibleGroupSettingsIds, setVisibleGroupSettingsIds] = useState<ReadonlySet<number>>(() => new Set());
  const lastOverExerciseIdRef = useRef<string | null>(null);

  const exercises = useTemplateBuilderStore((state) => state.exercises);
  const exerciseIndex = useTemplateBuilderStore((state) => state.exerciseIndex);
  const durationEnabledExerciseIds = useTemplateBuilderStore((state) => state.durationEnabledExerciseIds);
  const isAddExerciseModalOpen = useTemplateBuilderStore((state) => state.isAddExerciseModalOpen);
  const quickSetPopover = useTemplateBuilderStore((state) => state.quickSetPopover);

  const openAddExerciseModal = useTemplateBuilderStore((state) => state.openAddExerciseModal);
  const openAddExerciseModalForGroup = useTemplateBuilderStore(
    (state) => state.openAddExerciseModalForGroup,
  );
  const setGroupCollapse = useTemplateBuilderStore((state) => state.setGroupCollapse);
  const setExerciseGrouping = useTemplateBuilderStore((state) => state.setExerciseGrouping);
  const endExerciseDrag = useTemplateBuilderStore((state) => state.endExerciseDrag);

  const exerciseIndexById = useMemo(
    () => new Map(exerciseIndex.map((item) => [item.id, item] as const)),
    [exerciseIndex],
  );

  const getExerciseDisplayName = (exerciseId: number): string =>
    exerciseIndexById.get(exerciseId)?.name ?? `Exercise #${exerciseId}`;

  const exerciseRenderBlocks = useMemo(
    () => buildExerciseRenderBlocks(exercises),
    [exercises],
  );
  const exerciseSortingStrategy = useMemo(
    () => createExerciseSortingStrategy(exercises, isMobileViewport),
    [exercises, isMobileViewport],
  );
  const dragModifiers = useMemo(
    () => isMobileViewport ? [restrictToVerticalAxis] : undefined,
    [isMobileViewport],
  );
  const activeDragExerciseItem = useMemo(() => {
    if (!activeDragExerciseId) {
      return null;
    }

    const exerciseIndex = exercises.findIndex((exercise) => exercise.id === activeDragExerciseId);
    if (exerciseIndex < 0) {
      return null;
    }
    const exercise = exercises[exerciseIndex];
    if (!exercise) {
      return null;
    }

    return {
      exercise,
      exerciseIndex,
    };
  }, [activeDragExerciseId, exercises]);

  const isAnyBlockingOverlayOpen = isAddExerciseModalOpen || quickSetPopover !== null;

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

    if (!overExerciseId) {
      resetExerciseDrag();
      return;
    }

    if (activeExerciseId === overExerciseId) {
      resetExerciseDrag();
      return;
    }

    endExerciseDrag(activeExerciseId, overExerciseId);
    resetExerciseDrag();
  };

  const handleExerciseDragCancel = () => {
    resetExerciseDrag();
  };

  const handleAddExerciseClick = () => {
    openAddExerciseModal();
  };

  const toggleGroupSettingsVisibility = (groupId: number) => {
    setVisibleGroupSettingsIds((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }

      return next;
    });
  };

  return (
    <>
      <div className="mt-5 py-5 md:px-2 md:py-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-5">
          <div className="border-t border-gray-100/10" />
          <div className="text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-muted md:text-lg">
              Exercises
            </div>
            <p className="mt-0.5 max-w-3xs text-xs text-secondary md:max-w-100">
              Add exercises from your library and configure set targets.
            </p>
          </div>
          <div className="border-t border-gray-100/10" />
        </div>
      </div>

      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        modifiers={dragModifiers}
        onDragStart={handleExerciseDragStart}
        onDragOver={handleExerciseDragOver}
        onDragEnd={handleExerciseDragEnd}
        onDragCancel={handleExerciseDragCancel}
      >
        <SortableContext items={exercises.map((exercise) => exercise.id)} strategy={exerciseSortingStrategy}>
          <div className="flex flex-col items-stretch justify-start gap-4 md:flex-row md:flex-wrap md:items-center">
            {exerciseRenderBlocks.map((block) => {
              if (block.kind === "single") {
                const { exercise } = block;

                return (
                  <SortableHandleItem
                    key={exercise.id}
                    id={exercise.id}
                    className="w-full md:w-auto"
                    disabled={isAnyBlockingOverlayOpen}
                  >
                    {({ dragHandleProps, setDragHandleRef, isDragging }) => (
                      <TemplateExerciseCard
                        exercise={exercise}
                        exerciseDisplayName={getExerciseDisplayName(exercise.exerciseId)}
                        isDurationEnabled={durationEnabledExerciseIds.has(exercise.id)}
                        onOpenQuickSetPopover={onOpenQuickSetPopover}
                        dragHandleProps={dragHandleProps}
                        setDragHandleRef={setDragHandleRef}
                        isDragging={isDragging || activeDragExerciseId === exercise.id}
                      />
                    )}
                  </SortableHandleItem>
                );
              }

              const groupTypeLabel = block.groupType === ExerciseGroupType.Circuit ? "Circuit" : "Superset";
              const GroupTypeIcon = block.groupType === ExerciseGroupType.Circuit ? LuRepeat : LuLayers;
              const addAnchorExercise = block.items[block.items.length - 1]?.exercise;
              const groupExerciseIds = block.items.map(({ exercise }) => exercise.id);
              const isGroupCollapsed = block.items.every(({ exercise }) => exercise.collapsed);
              const isCompactGroupAddColumn = block.items.length > 1;
              const areGroupSettingsVisible = visibleGroupSettingsIds.has(block.groupId);
              const groupSettingsId = `template-builder-group-${block.groupId}-settings`;

              const handleAddGroupedExerciseClick = () => {
                if (!addAnchorExercise) {
                  return;
                }

                openAddExerciseModalForGroup(addAnchorExercise.id, block.groupType, block.groupId);
              };

              const handleGroupCollapseToggleClick = () => {
                setGroupCollapse(groupExerciseIds, !isGroupCollapsed);
              };

              const handleGroupSettingsToggleClick = () => {
                toggleGroupSettingsVisibility(block.groupId);
              };

              const handleGroupTypeChange = (nextGroupType: ExerciseGroupType) => {
                const groupAnchorExercise = block.items[0]?.exercise;
                if (!groupAnchorExercise) {
                  return;
                }

                setExerciseGrouping(groupAnchorExercise.id, nextGroupType);
              };

              return (
                <article
                  key={`group-${block.groupId}`}
                  className="liquid-panel w-full rounded-3xl p-4 md:w-auto md:max-w-full md:p-5"
                >
                  <div className="mb-3 space-y-2 px-1 md:px-0">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleGroupCollapseToggleClick}
                        className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary transition hover:text-primary-400 md:hidden"
                        aria-label={isGroupCollapsed ? `Expand ${groupTypeLabel} set` : `Collapse ${groupTypeLabel} set`}
                      >
                        <GroupTypeIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{groupTypeLabel} Set</span>
                        <LuChevronDown
                          className={[
                            "h-3.5 w-3.5 transition-transform",
                            isGroupCollapsed ? "rotate-0" : "rotate-180",
                          ].join(" ")}
                        />
                      </button>
                      <p className="hidden min-w-0 items-center gap-1 text-2xs font-semibold text-primary md:flex">
                        <GroupTypeIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{groupTypeLabel} Set</span>
                      </p>
                      <button
                        type="button"
                        onClick={handleGroupSettingsToggleClick}
                        className={[
                          "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full p-0 text-xs font-semibold transition md:h-7 md:w-7 md:text-2xs",
                          areGroupSettingsVisible
                            ? "bg-primary-100 text-primary-900 hover:bg-primary-100"
                            : "text-secondary hover:bg-white/8 hover:text-primary",
                        ].join(" ")}
                        aria-expanded={areGroupSettingsVisible}
                        aria-controls={groupSettingsId}
                        aria-label={areGroupSettingsVisible ? "Hide group settings" : "Show group settings"}
                      >
                        <LuSlidersHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                    {areGroupSettingsVisible ? (
                      <SegmentControl
                        id={groupSettingsId}
                        value={block.groupType}
                        onChange={handleGroupTypeChange}
                        options={GROUP_TYPE_SEGMENT_OPTIONS}
                        className="w-full py-2 md:py-1"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
                    <div className="flex min-w-0 flex-col gap-3 md:flex-1 md:flex-row md:flex-wrap md:items-start">
                      {block.items.map(({ exercise }) => (
                        <SortableHandleItem
                          key={exercise.id}
                          id={exercise.id}
                          className="w-full md:w-auto"
                          disabled={isAnyBlockingOverlayOpen}
                        >
                          {({ dragHandleProps, setDragHandleRef, isDragging }) => (
                            <TemplateExerciseCard
                              exercise={exercise}
                              exerciseDisplayName={getExerciseDisplayName(exercise.exerciseId)}
                              isDurationEnabled={durationEnabledExerciseIds.has(exercise.id)}
                              onOpenQuickSetPopover={onOpenQuickSetPopover}
                              dragHandleProps={dragHandleProps}
                              setDragHandleRef={setDragHandleRef}
                              isDragging={isDragging || activeDragExerciseId === exercise.id}
                            />
                          )}
                        </SortableHandleItem>
                      ))}
                    </div>
                    <div className="flex w-full justify-end md:w-20 md:shrink-0">
                      <button
                        type="button"
                        onClick={handleAddGroupedExerciseClick}
                        className="liquid-template-dashed flex h-12 w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-1.5 py-3 text-xs font-semibold text-primary-700 transition hover:text-primary md:h-full md:min-h-0 md:w-20 md:flex-col"
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
        </SortableContext>
        <DragOverlay
          adjustScale={false}
          className="pointer-events-none cursor-grabbing"
          dropAnimation={null}
          modifiers={dragModifiers}
          zIndex={500}
        >
          {activeDragExerciseItem ? (
            <TemplateExerciseCard
              exercise={activeDragExerciseItem.exercise}
              exerciseDisplayName={getExerciseDisplayName(activeDragExerciseItem.exercise.exerciseId)}
              isDurationEnabled={durationEnabledExerciseIds.has(activeDragExerciseItem.exercise.id)}
              onOpenQuickSetPopover={onOpenQuickSetPopover}
              isDragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <button
        type="button"
        onClick={handleAddExerciseClick}
        className="liquid-template-dashed hidden w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-700 transition sm:flex"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-200 text-primary-700">
          <LuPlus className="h-3.5 w-3.5" />
        </span>
        <span>Add Exercise</span>
      </button>

      {!isAnyBlockingOverlayOpen ? (
        <button
          type="button"
          onClick={handleAddExerciseClick}
          className="liquid-primary-btn fixed bottom-28 right-5 z-90 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full md:hidden"
          aria-label="Add Exercise"
        >
          <LuPlus className="h-5 w-5" />
        </button>
      ) : null}
    </>
  );
}
