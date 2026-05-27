import { useState } from "react";
import { LuLayers, LuPlus, LuRepeat, LuSlidersHorizontal } from "react-icons/lu";
import { ExerciseGroupType, type ExerciseSetType, type PreviousExerciseSets } from "@/types";
import {
  SegmentControl,
  SegmentControlSize,
  type SegmentControlOption,
} from "@/shared/components";
import type {
  WorkoutExerciseGroupDraft,
  WorkoutSetMetricField,
} from "../utils/workoutDraft";
import { WorkoutExerciseCard } from "./WorkoutExerciseCard";

const GROUP_TYPE_SEGMENT_OPTIONS: ReadonlyArray<SegmentControlOption<ExerciseGroupType>> = [
  { value: ExerciseGroupType.Superset, label: "Superset" },
  { value: ExerciseGroupType.Circuit, label: "Circuit" },
  { value: ExerciseGroupType.Straight, label: "Make singles" },
];

type WorkoutExerciseGroupCardProps = {
  group: WorkoutExerciseGroupDraft;
  previousSetsByExerciseId: Record<number, PreviousExerciseSets>;
  onExerciseNotesChange: (exerciseDraftId: string, value: string) => void;
  onExerciseMetricModeChange: (exerciseDraftId: string, isDurationEnabled: boolean) => void;
  onExerciseGroupingChange: (exerciseDraftId: string, groupType: ExerciseGroupType) => void;
  onAddExerciseToGroup: (
    insertAfterExerciseId: string,
    groupType: ExerciseGroupType,
    clientGroupId: number,
  ) => void;
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
};

export function WorkoutExerciseGroupCard({
  group,
  previousSetsByExerciseId,
  onExerciseNotesChange,
  onExerciseMetricModeChange,
  onExerciseGroupingChange,
  onAddExerciseToGroup,
  onRemoveExercise,
  onSetTypeChange,
  onSetCompletedToggle,
  onAddSet,
  onRemoveSet,
  onSetReorder,
  onOpenQuickSetPopover,
}: WorkoutExerciseGroupCardProps) {
  const [areGroupSettingsVisible, setAreGroupSettingsVisible] = useState(false);
  const isGrouped = group.groupType !== ExerciseGroupType.Straight;
  const groupTypeLabel = group.groupType === ExerciseGroupType.Circuit ? "Circuit" : "Superset";
  const GroupTypeIcon = group.groupType === ExerciseGroupType.Circuit ? LuRepeat : LuLayers;
  const addAnchorExercise = group.exercises[group.exercises.length - 1];
  const exerciseCards = group.exercises.map((exercise) => (
    <WorkoutExerciseCard
      key={exercise.id}
      exercise={exercise}
      previousSets={previousSetsByExerciseId[exercise.exerciseId]}
      onExerciseNotesChange={onExerciseNotesChange}
      onExerciseMetricModeChange={onExerciseMetricModeChange}
      onExerciseGroupingChange={onExerciseGroupingChange}
      onRemoveExercise={onRemoveExercise}
      onSetTypeChange={onSetTypeChange}
      onSetCompletedToggle={onSetCompletedToggle}
      onAddSet={onAddSet}
      onRemoveSet={onRemoveSet}
      onSetReorder={onSetReorder}
      onOpenQuickSetPopover={onOpenQuickSetPopover}
    />
  ));

  if (!isGrouped) {
    return <>{exerciseCards}</>;
  }

  const handleGroupSettingsToggleClick = () => {
    setAreGroupSettingsVisible((current) => !current);
  };

  const handleGroupTypeChange = (nextGroupType: ExerciseGroupType) => {
    const groupAnchorExercise = group.exercises[0];
    if (!groupAnchorExercise) {
      return;
    }

    onExerciseGroupingChange(groupAnchorExercise.id, nextGroupType);
  };

  const handleAddGroupedExerciseClick = () => {
    if (!addAnchorExercise || addAnchorExercise.clientGroupId === undefined) {
      return;
    }

    onAddExerciseToGroup(addAnchorExercise.id, group.groupType, addAnchorExercise.clientGroupId);
  };

  return (
    <section className="liquid-panel w-full rounded-3xl p-4 md:w-auto md:max-w-full md:rounded-2xl md:p-5">
      <div className="mb-3 space-y-2 px-1 md:px-0">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1 text-xs font-semibold text-primary">
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
            aria-label={areGroupSettingsVisible ? "Hide group settings" : "Show group settings"}
          >
            <LuSlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {areGroupSettingsVisible ? (
          <SegmentControl
            value={group.groupType}
            onChange={handleGroupTypeChange}
            options={GROUP_TYPE_SEGMENT_OPTIONS}
            size={SegmentControlSize.Sm}
            className="w-full py-1"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <div className="flex min-w-0 flex-col gap-3 md:flex-1 md:flex-row md:flex-wrap md:items-start">
          {exerciseCards}
        </div>
        <div className="flex w-full justify-end md:w-20 md:shrink-0">
          <button
            type="button"
            onClick={handleAddGroupedExerciseClick}
            className="liquid-template-dashed flex h-12 w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-1.5 py-3 text-xs font-semibold text-primary-700 transition hover:text-primary md:h-full md:min-h-0 md:w-20 md:flex-col"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-200 text-primary-700">
              <LuPlus className="h-3 w-3" />
            </span>
            <span>Add</span>
          </button>
        </div>
      </div>
    </section>
  );
}
