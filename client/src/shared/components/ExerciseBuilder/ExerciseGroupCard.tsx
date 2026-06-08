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
import { LuChevronDown, LuLayers, LuPlus, LuRepeat, LuSlidersHorizontal } from "react-icons/lu";
import { SortableHandleItem, useDndSensors } from "@/shared/components/Dnd";
import { SegmentControl, type SegmentControlOption } from "@/shared/components/Inputs";
import { ExerciseGroupType } from "@/types";
import { getGroupBlockId, type ExerciseRenderBlock } from "./dnd";
import { ExerciseCard } from "./ExerciseCard";
import type {
  ExerciseBuilderCallbacks,
  ExerciseBuilderCapabilities,
} from "./types";

const GROUP_TYPE_SEGMENT_OPTIONS: ReadonlyArray<SegmentControlOption<ExerciseGroupType>> = [
  { value: ExerciseGroupType.Superset, label: "Superset" },
  { value: ExerciseGroupType.Circuit, label: "Circuit" },
  { value: ExerciseGroupType.Straight, label: "Make singles" },
];

type GroupRenderBlock = Extract<ExerciseRenderBlock, { kind: "group" }>;

type ExerciseGroupCardProps = {
  block: GroupRenderBlock;
  capabilities: ExerciseBuilderCapabilities;
  callbacks: ExerciseBuilderCallbacks;
  isInteractionLocked: boolean;
  isMobileViewport: boolean;
};

export function ExerciseGroupCard({
  block,
  capabilities,
  callbacks,
  isInteractionLocked,
  isMobileViewport,
}: ExerciseGroupCardProps) {
  const dndSensors = useDndSensors();

  const [areGroupSettingsVisible, setAreGroupSettingsVisible] = useState(false);
  const [activeDragMemberId, setActiveDragMemberId] = useState<string | null>(null);
  const lastOverMemberIdRef = useRef<string | null>(null);

  const memberStrategy = isMobileViewport
    ? verticalListSortingStrategy
    : horizontalListSortingStrategy;
  const dragModifiers = useMemo(
    () => (isMobileViewport ? [restrictToVerticalAxis] : undefined),
    [isMobileViewport],
  );

  const groupTypeLabel = block.groupType === ExerciseGroupType.Circuit ? "Circuit" : "Superset";
  const GroupTypeIcon = block.groupType === ExerciseGroupType.Circuit ? LuRepeat : LuLayers;
  const addAnchorExercise = block.items[block.items.length - 1]?.exercise;
  const groupAnchorExercise = block.items[0]?.exercise;
  const groupExerciseIds = block.items.map(({ exercise }) => exercise.id);
  const isGroupCollapsed = block.items.every(({ exercise }) => exercise.collapsed);
  const groupSettingsId = `exercise-builder-group-${block.groupId}-settings`;

  const activeDragMember = useMemo(() => {
    if (!activeDragMemberId) {
      return null;
    }

    return block.items.find(({ exercise }) => exercise.id === activeDragMemberId)?.exercise ?? null;
  }, [activeDragMemberId, block.items]);

  const handleAddGroupedExerciseClick = () => {
    if (!addAnchorExercise) {
      return;
    }

    callbacks.onAddExerciseToGroup(addAnchorExercise.id, block.groupType, block.groupId);
  };

  const handleGroupCollapseToggleClick = () => {
    callbacks.onSetGroupCollapse?.(groupExerciseIds, !isGroupCollapsed);
  };

  const handleGroupSettingsToggleClick = () => {
    setAreGroupSettingsVisible((previous) => !previous);
  };

  const handleGroupTypeChange = (nextGroupType: ExerciseGroupType) => {
    if (!groupAnchorExercise) {
      return;
    }

    callbacks.onExerciseGroupingChange(groupAnchorExercise.id, nextGroupType);
  };

  const resetMemberDrag = () => {
    lastOverMemberIdRef.current = null;
    setActiveDragMemberId(null);
  };

  const handleMemberDragStart = (event: DragStartEvent) => {
    const activeMemberId = String(event.active.id);
    lastOverMemberIdRef.current = activeMemberId;
    setActiveDragMemberId(activeMemberId);
  };

  const handleMemberDragOver = (event: DragOverEvent) => {
    if (!event.over) {
      return;
    }

    lastOverMemberIdRef.current = String(event.over.id);
  };

  const handleMemberDragEnd = (event: DragEndEvent) => {
    const activeMemberId = String(event.active.id);
    const overMemberId =
      lastOverMemberIdRef.current && lastOverMemberIdRef.current !== activeMemberId
        ? lastOverMemberIdRef.current
        : event.over
          ? String(event.over.id)
          : lastOverMemberIdRef.current;

    if (!overMemberId || activeMemberId === overMemberId) {
      resetMemberDrag();
      return;
    }

    callbacks.onExerciseReorder?.(activeMemberId, overMemberId);
    resetMemberDrag();
  };

  const handleMemberDragCancel = () => {
    resetMemberDrag();
  };

  const memberListClassName =
    "flex min-w-0 flex-col gap-3 md:flex-1 md:flex-row md:flex-wrap md:items-stretch";

  const memberCards = block.items.map(({ exercise }) => {
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
            isDragging={isDragging || activeDragMemberId === exercise.id}
          />
        )}
      </SortableHandleItem>
    );
  });

  const membersRegion = capabilities.allowExerciseDnd ? (
    <DndContext
      sensors={dndSensors}
      collisionDetection={closestCenter}
      modifiers={dragModifiers}
      onDragStart={handleMemberDragStart}
      onDragOver={handleMemberDragOver}
      onDragEnd={handleMemberDragEnd}
      onDragCancel={handleMemberDragCancel}
    >
      <SortableContext items={groupExerciseIds} strategy={memberStrategy}>
        <div className={memberListClassName}>{memberCards}</div>
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
              {activeDragMember ? (
                <ExerciseCard
                  exercise={activeDragMember}
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
    <div className={memberListClassName}>{memberCards}</div>
  );

  const article = (
    <article className="liquid-panel w-full rounded-3xl p-4 md:w-auto md:max-w-full md:p-5">
      <div className="mb-3 space-y-2 px-1 md:px-0">
        <div className="flex items-center justify-between gap-2">
          {capabilities.allowCollapse ? (
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
          ) : null}
          <p
            className={[
              "min-w-0 items-center gap-1 text-2xs font-semibold text-primary",
              capabilities.allowCollapse ? "hidden md:flex" : "flex",
            ].join(" ")}
          >
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
        {membersRegion}
        <div className="flex w-full justify-end md:w-10 md:shrink-0">
          <button
            type="button"
            onClick={handleAddGroupedExerciseClick}
            className="liquid-template-dashed flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl p-3 text-xs font-semibold text-primary-700 transition hover:text-primary md:h-full md:min-h-0"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-200 text-primary-700 shrink-0">
              <LuPlus className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
      </div>
    </article>
  );

  if (!capabilities.allowExerciseDnd) {
    return <div className="w-full md:flex md:w-auto">{article}</div>;
  }

  return (
    <SortableHandleItem
      id={getGroupBlockId(block.groupId)}
      className="w-full md:flex md:w-auto"
      disabled={isInteractionLocked}
    >
      {() => article}
    </SortableHandleItem>
  );
}
