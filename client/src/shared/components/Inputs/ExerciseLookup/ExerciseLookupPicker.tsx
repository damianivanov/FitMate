import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useExerciseLookup } from "@/hooks/useExerciseLookup";
import { useUserStore } from "@/stores/userStore";
import type { ExerciseLookupModel, MuscleGroup } from "@/types";
import { ExerciseLookupResults } from "./ExerciseLookupResults";
import { ExerciseLookupSearchBar } from "./ExerciseLookupSearchBar";
import { MuscleGroupChipSelector } from "./MuscleGroupChipSelector";
import { SelectedExerciseSummary } from "./SelectedExerciseSummary";

type ExerciseLookupPickerProps = {
  idPrefix: string;
  muscleGroups: MuscleGroup[];
  searchValue: string;
  muscleGroupFilterId: string;
  selectedExercise: ExerciseLookupModel | null;
  onSearchChange: (value: string) => void;
  onMuscleGroupFilterChange: (value: string) => void;
  onSelectExercise: (exercise: ExerciseLookupModel) => void;
  onClearSelection: () => void;
  refreshKey?: number;
  enabled?: boolean;
  take?: number;
  searchLabel?: string;
  filterLabel?: string;
  searchPlaceholder?: string;
  selectedLabelPrefix?: string;
  selectedExtra?: ReactNode;
};

function buildOptionMetaLabel(
  option: ExerciseLookupModel,
  currentUserId: number,
): { label: string; isOwnedByCurrentUser: boolean } {
  const parts = [option.primaryMuscleGroupName];

  if (option.secondaryMuscleGroupName) {
    parts.push(option.secondaryMuscleGroupName);
  }

  const isOwnedByCurrentUser = currentUserId > 0 && option.creatorUserId === currentUserId;
  if (option.creatorDisplayName) {
    parts.push(isOwnedByCurrentUser ? "You" : option.creatorDisplayName);
  }

  return {
    label: parts.join(" | "),
    isOwnedByCurrentUser,
  };
}

function buildSelectedMetaLabel(option: ExerciseLookupModel): string {
  const parts = [option.primaryMuscleGroupName];

  if (option.secondaryMuscleGroupName) {
    parts.push(option.secondaryMuscleGroupName);
  }

  return parts.join(" | ");
}

export function ExerciseLookupPicker({
  idPrefix,
  muscleGroups,
  searchValue,
  muscleGroupFilterId,
  selectedExercise,
  onSearchChange,
  onMuscleGroupFilterChange,
  onSelectExercise,
  onClearSelection,
  refreshKey = 0,
  enabled = true,
  take = 20,
  searchLabel = "Choose Exercise",
  filterLabel = "Filter by Muscle Group",
  searchPlaceholder = "Search exercises...",
  selectedLabelPrefix = "Selected:",
  selectedExtra,
}: ExerciseLookupPickerProps) {
  const currentUserId = useUserStore((state) => state.user.id);
  const muscleGroupId = muscleGroupFilterId ? Number(muscleGroupFilterId) : undefined;
  const muscleGroupIds = useMemo(
    () => (muscleGroupId ? [muscleGroupId] : undefined),
    [muscleGroupId],
  );
  const { options, isLoading, error, reload, hasQuery } = useExerciseLookup({
    search: searchValue,
    muscleGroupIds,
    enabled,
    take,
  });

  useEffect(() => {
    if (refreshKey <= 0) {
      return;
    }

    void reload();
  }, [refreshKey, reload]);

  const optionViewModels = useMemo(
    () => options.map((option) => {
      const { label, isOwnedByCurrentUser } = buildOptionMetaLabel(option, currentUserId);

      return {
        option,
        metaLabel: label,
        isOwnedByCurrentUser,
      };
    }),
    [options, currentUserId],
  );

  return (
    <div className="space-y-3 md:col-span-2">
      <ExerciseLookupSearchBar
        id={`${idPrefix}-search`}
        label={searchLabel}
        value={searchValue}
        placeholder={selectedExercise?.name ?? searchPlaceholder}
        hasQuery={hasQuery}
        resultCount={options.length}
        onChange={onSearchChange}
      />

      <MuscleGroupChipSelector
        label={filterLabel}
        muscleGroups={muscleGroups}
        selectedMuscleGroupId={muscleGroupFilterId}
        onSelect={onMuscleGroupFilterChange}
      />

      <ExerciseLookupResults
        isLoading={isLoading}
        error={error}
        hasQuery={hasQuery}
        options={optionViewModels}
        onSelectExercise={onSelectExercise}
      />

      {selectedExercise ? (
        <SelectedExerciseSummary
          selectedExercise={selectedExercise}
          selectedLabelPrefix={selectedLabelPrefix}
          metaLabel={buildSelectedMetaLabel(selectedExercise)}
          onClearSelection={onClearSelection}
          selectedExtra={selectedExtra}
        />
      ) : null}
    </div>
  );
}
