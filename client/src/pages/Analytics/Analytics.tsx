import { LuActivity, LuDumbbell, LuListChecks, LuTrendingUp, LuTrophy } from "react-icons/lu";
import {
  AsyncSection,
  ExerciseLookupPicker,
  LineChart,
  MuscleGroupDropdown,
  NativeCard,
  NativeGlyph,
  NativeList,
  NativePage,
  NativeRow,
  NativeSection,
  NativeStat,
  NativeStatGrid,
  PageBody,
  PageIntro,
  SegmentControl,
  SegmentControlSize,
} from "@/shared/components";
import { MuscleBalance } from "./components/MuscleBalance";
import { TrainingHighlights } from "./components/TrainingHighlights";
import { useAnalyticsPage, type AnalyticsRangePreset } from "./hooks/useAnalyticsPage";
import { formatVolume } from "./utils/analyticsFormat";
import "./analytics.css";

const RANGE_OPTIONS: { label: string; value: AnalyticsRangePreset }[] = [
  { label: "4W", value: "4w" },
  { label: "12W", value: "12w" },
  { label: "1Y", value: "1y" },
  { label: "All", value: "all" },
];

function formatTons(totalKg: number): { value: string; unit: string } {
  return totalKg >= 1000
    ? { value: (totalKg / 1000).toFixed(1), unit: "tons" }
    : { value: String(Math.round(totalKg)), unit: "kg" };
}

export default function Analytics() {
  const { state, actions } = useAnalyticsPage();
  const overview = state.overview;
  const total = overview ? formatTons(overview.totalVolumeKg) : null;

  return (
    <PageBody>
      <NativePage className="an-page">
        <div className="flex w-full items-center justify-between gap-3 sm:gap-6 md:gap-8">
          <PageIntro eyebrow="Your training" title="Progress" className="shrink-0" />

          <SegmentControl
            value={state.rangePreset}
            options={RANGE_OPTIONS}
            onChange={actions.setRange}
            size={SegmentControlSize.Sm}
            className="max-w-48 min-w-40 basis-48 text-center"
            label="Date range"
          />
        </div>

        <AsyncSection
          isLoading={state.isLoadingOverview}
          error={state.overviewError}
          onRetry={actions.reloadOverview}
          loadingLabel="Loading analytics..."
        >
          {overview ? (
            <div className="an-dashboard">
              <NativeStatGrid>
                <NativeStat
                  tint="orange"
                  icon={<LuDumbbell className="h-5 w-5" />}
                  label="Workouts"
                  value={overview.workoutCount.toLocaleString()}
                  caption="Completed in range"
                />
                <NativeStat
                  tint="purple"
                  icon={<LuActivity className="h-5 w-5" />}
                  label="Volume"
                  value={formatVolume(overview.totalVolumeKg)}
                  caption="Weight moved"
                />
                <NativeStat
                  tint="green"
                  icon={<LuListChecks className="h-5 w-5" />}
                  label="Sets"
                  value={overview.totalSets.toLocaleString()}
                  caption={`${overview.totalReps.toLocaleString()} reps`}
                />
                <NativeStat
                  tint="blue"
                  icon={<LuTrophy className="h-5 w-5" />}
                  label="Records"
                  value={overview.personalRecords.length.toLocaleString()}
                  caption="Best efforts logged"
                />
              </NativeStatGrid>

              <TrainingHighlights
                frequentExercises={overview.frequentExercises ?? []}
                personalRecords={overview.personalRecords}
              />

              <NativeSection title="Volume trend">
                <NativeCard className="an-chart-card">
                  {total ? (
                    <div className="an-total">
                      <span>Total volume</span>
                      <b>
                        {total.value}
                        <small> {total.unit}</small>
                      </b>
                    </div>
                  ) : null}

                  <div className="an-chart">
                    <LineChart
                      points={state.volumePoints}
                      valueSuffix=" kg"
                      emptyText="Complete workouts to see your volume trend."
                    />
                  </div>
                </NativeCard>
              </NativeSection>

              <NativeSection title="Muscle balance">
                <NativeCard>
                  <MuscleBalance items={overview.muscleGroupVolumes} />
                </NativeCard>
              </NativeSection>

              <NativeSection
                title="Records"
                action={
                  <div className="an-records-filter">
                    <MuscleGroupDropdown
                      muscleGroups={state.recordsMuscleGroups}
                      value={state.recordsMuscleGroupId || null}
                      onChange={(value) => actions.filterRecordsByMuscleGroup(value ?? "")}
                      placeholder="All muscles"
                      searchable
                      searchPlaceholder="Search..."
                      clearable
                    />
                  </div>
                }
              >
                {state.personalRecords.length === 0 ? (
                  <NativeCard>
                    <p className="an-empty">No records in this range yet.</p>
                  </NativeCard>
                ) : (
                  <NativeList>
                    {state.personalRecords.map((record) => (
                      <NativeRow
                        key={record.exerciseId}
                        glyph={
                          <NativeGlyph tint="orange">
                            <LuTrophy className="h-5 w-5" />
                          </NativeGlyph>
                        }
                        title={record.exerciseName}
                        subtitle={record.primaryMuscleGroupName}
                        value={
                          record.bestWeightKg != null ? `${record.bestWeightKg} kg` : "—"
                        }
                      />
                    ))}
                  </NativeList>
                )}
              </NativeSection>

              <NativeSection title="Exercise progression">
                <NativeCard className="an-picker">
                  <ExerciseLookupPicker
                    idPrefix="analytics-progression"
                    muscleGroups={state.muscleGroups}
                    searchValue={state.searchValue}
                    muscleGroupFilterId={state.muscleGroupFilterId}
                    selectedExercise={state.selectedExercise}
                    onSearchChange={actions.search}
                    onMuscleGroupFilterChange={actions.filterByMuscleGroup}
                    onSelectExercise={actions.selectExercise}
                    onClearSelection={actions.clearExercise}
                    searchLabel="Choose exercise"
                    filterVariant="dropdown"
                  />

                  {state.selectedExercise ? (
                    state.isLoadingProgression ? (
                      <p className="an-empty">Loading progression...</p>
                    ) : state.progressionError ? (
                      <p className="an-empty">{state.progressionError}</p>
                    ) : (
                      <div className="an-chart">
                        <LineChart
                          points={state.progressionPoints}
                          valueSuffix=" kg"
                          emptyText={`No completed sets for ${state.selectedExercise.name} in this range.`}
                          baseline="data"
                        />
                      </div>
                    )
                  ) : (
                    <p className="an-empty">
                      <LuTrendingUp className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
                      Pick an exercise to chart its estimated 1RM.
                    </p>
                  )}
                </NativeCard>
              </NativeSection>
            </div>
          ) : null}
        </AsyncSection>
      </NativePage>
    </PageBody>
  );
}
