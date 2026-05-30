import { AsyncSection, ExerciseLookupPicker, PageBody, PageHeader } from "@/shared/components";
import { LineChart } from "./components/LineChart";
import { MuscleGroupBars } from "./components/MuscleGroupBars";
import { PersonalRecordsList } from "./components/PersonalRecordsList";
import { StatTile } from "./components/StatTile";
import { useAnalyticsPage, type AnalyticsRangePreset } from "./hooks/useAnalyticsPage";
import { formatVolume } from "./utils/analyticsFormat";

const RANGE_OPTIONS: { key: AnalyticsRangePreset; label: string }[] = [
  { key: "4w", label: "4W" },
  { key: "12w", label: "12W" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
];

export default function Analytics() {
  const { state, actions } = useAnalyticsPage();

  return (
    <>
      <PageHeader
        title="Analytics"
        actions={
          <div className="liquid-pill inline-flex items-center gap-1 rounded-full p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => actions.setRange(option.key)}
                className={[
                  "inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-xs font-semibold transition",
                  state.rangePreset === option.key
                    ? "liquid-primary-chip text-foreground"
                    : "text-secondary hover:text-foreground",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <PageBody>
        <div className="mx-auto max-w-5xl space-y-5">
          <AsyncSection
            isLoading={state.isLoadingOverview}
            error={state.overviewError}
            onRetry={actions.reloadOverview}
            loadingLabel="Loading analytics..."
          >
            {state.overview ? (
              <>
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Workouts" value={state.overview.workoutCount.toLocaleString()} />
                  <StatTile label="Volume" value={formatVolume(state.overview.totalVolumeKg)} />
                  <StatTile label="Sets" value={state.overview.totalSets.toLocaleString()} />
                  <StatTile label="Reps" value={state.overview.totalReps.toLocaleString()} />
                </section>

                <section className="liquid-panel rounded-2xl p-4 md:rounded-lg md:p-5">
                  <h2 className="text-base font-bold text-foreground">Volume trend</h2>
                  <p className="mt-0.5 text-xs text-secondary">Total volume per week</p>
                  <div className="mt-4">
                    <LineChart
                      points={state.volumePoints}
                      valueSuffix=" kg"
                      emptyText="Complete workouts to see your volume trend."
                    />
                  </div>
                </section>

                <section className="liquid-panel rounded-2xl p-4 md:rounded-lg md:p-5">
                  <h2 className="text-base font-bold text-foreground">Exercise progression</h2>
                  <p className="mt-0.5 text-xs text-secondary">
                    Estimated 1RM over time for a chosen exercise
                  </p>

                  <div className="mt-4">
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
                    />
                  </div>

                  {state.selectedExercise ? (
                    <div className="mt-4">
                      {state.isLoadingProgression ? (
                        <div className="flex h-40 items-center justify-center rounded-xl bg-white/5 text-sm text-muted">
                          Loading progression...
                        </div>
                      ) : state.progressionError ? (
                        <div className="flex h-40 items-center justify-center rounded-xl bg-white/5 text-sm text-danger">
                          {state.progressionError}
                        </div>
                      ) : (
                        <LineChart
                          points={state.progressionPoints}
                          valueSuffix=" kg"
                          emptyText={`No completed sets for ${state.selectedExercise.name} in this range.`}
                        />
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl bg-white/5 px-4 py-6 text-center text-sm text-muted">
                      Select an exercise to see its progression.
                    </p>
                  )}
                </section>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="liquid-panel rounded-2xl p-4 md:rounded-lg md:p-5">
                    <h2 className="text-base font-bold text-foreground">Muscle group distribution</h2>
                    <p className="mt-0.5 text-xs text-secondary">Volume by primary muscle group</p>
                    <div className="mt-4">
                      <MuscleGroupBars items={state.overview.muscleGroupVolumes} />
                    </div>
                  </section>

                  <section className="liquid-panel rounded-2xl p-4 md:rounded-lg md:p-5">
                    <h2 className="text-base font-bold text-foreground">Personal records</h2>
                    <p className="mt-0.5 text-xs text-secondary">Best efforts per exercise</p>
                    <div className="mt-4">
                      <PersonalRecordsList items={state.overview.personalRecords} />
                    </div>
                  </section>
                </div>
              </>
            ) : null}
          </AsyncSection>
        </div>
      </PageBody>
    </>
  );
}
