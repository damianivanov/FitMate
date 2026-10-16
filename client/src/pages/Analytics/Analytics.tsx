import { LuActivity, LuDumbbell, LuListChecks, LuTrophy } from "react-icons/lu";
import {
  AsyncSection,
  ExerciseLookupPicker,
  LineChart,
  MuscleGroupDropdown,
  NativeCard,
  NativeGlyph,
  NativeList,
  NativeRow,
  NativePage,
  NativeSection,
  NativeStat,
  NativeStatGrid,
  PageBody,
  PageIntro,
  SegmentControl,
  SegmentControlSize,
} from "@/shared/components";
import type { AnalyticsOverview } from "@/types";
import { ExerciseDetail } from "./components/ExerciseDetail";
import { MuscleBalance } from "./components/MuscleBalance";
import { TrainingHighlights } from "./components/TrainingHighlights";
import { useAnalyticsPage } from "./hooks/useAnalyticsPage";
import type { AnalyticsRangePreset, AnalyticsTab } from "./types";
import { formatKg, formatSessionDate, formatVolume } from "./utils/analyticsFormat";
import "./analytics.css";

const RANGE_OPTIONS: { label: string; value: AnalyticsRangePreset }[] = [
  { label: "4W", value: "4w" },
  { label: "12W", value: "12w" },
  { label: "1Y", value: "1y" },
  { label: "All", value: "all" },
];

const TAB_OPTIONS: { label: string; value: AnalyticsTab }[] = [
  { label: "Exercise", value: "exercise" },
  { label: "Overview", value: "overview" },
  { label: "Muscles", value: "muscles" },
  { label: "Records", value: "records" },
];

const QUICK_PICK_LIMIT = 5;

function formatTons(totalKg: number): { value: string; unit: string } {
  return totalKg >= 1000
    ? { value: (totalKg / 1000).toFixed(1), unit: "tons" }
    : { value: String(Math.round(totalKg)), unit: "kg" };
}

type AnalyticsPage = ReturnType<typeof useAnalyticsPage>;

export default function Analytics() {
  const page = useAnalyticsPage();
  const { state, actions } = page;

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

        <SegmentControl
          value={state.activeTab}
          options={TAB_OPTIONS}
          onChange={actions.selectTab}
          size={SegmentControlSize.Md}
          className="an-tabs"
        />

        {state.activeTab === "exercise" ? (
          <ExerciseTab page={page} />
        ) : (
          <AsyncSection
            isLoading={state.isLoadingOverview}
            error={state.overviewError}
            onRetry={actions.reloadOverview}
            loadingLabel="Loading analytics..."
          >
            {state.overview ? (
              state.activeTab === "overview" ? (
                <OverviewTab page={page} overview={state.overview} />
              ) : state.activeTab === "muscles" ? (
                <NativeSection title="Muscle balance">
                  <NativeCard>
                    <MuscleBalance items={state.overview.muscleGroupVolumes} />
                  </NativeCard>
                </NativeSection>
              ) : (
                <RecordsTab page={page} />
              )
            ) : null}
          </AsyncSection>
        )}
      </NativePage>
    </PageBody>
  );
}

function ExerciseTab({ page }: { page: AnalyticsPage }) {
  const { state, actions } = page;

  if (state.selectedExercise) {
    return (
      <ExerciseDetail
        exercise={state.selectedExercise}
        progression={state.progression}
        isLoading={state.isLoadingProgression}
        error={state.progressionError}
        metric={state.progressionMetric}
        points={state.progressionPoints}
        change={state.progressionChange}
        onRetry={actions.reloadProgression}
        onMetricChange={actions.selectProgressionMetric}
        onChangeExercise={actions.clearExercise}
      />
    );
  }

  const quickPicks = (state.overview?.frequentExercises ?? []).slice(0, QUICK_PICK_LIMIT);

  return (
    <div className="an-dashboard">
      <NativeCard className="an-picker">
        <ExerciseLookupPicker
          idPrefix="analytics-exercise"
          muscleGroups={state.muscleGroups}
          searchValue={state.searchValue}
          muscleGroupFilterId={state.muscleGroupFilterId}
          selectedExercise={null}
          onSearchChange={actions.search}
          onMuscleGroupFilterChange={actions.filterByMuscleGroup}
          onSelectExercise={actions.selectExercise}
          onClearSelection={actions.clearExercise}
          searchLabel="Choose exercise"
          filterVariant="dropdown"
        />
      </NativeCard>

      {quickPicks.length > 0 ? (
        <NativeSection title="Your frequent exercises">
          <NativeList>
            {quickPicks.map((exercise) => (
              <NativeRow
                key={exercise.exerciseId}
                glyph={
                  <NativeGlyph tint="orange">
                    <LuDumbbell className="h-5 w-5" />
                  </NativeGlyph>
                }
                title={exercise.exerciseName}
                subtitle={[
                  exercise.primaryMuscleGroupName,
                  `Last ${formatSessionDate(exercise.lastTrainedOn)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                value={`${exercise.workoutCount}×`}
                onClick={() => actions.openExercise({
                  id: exercise.exerciseId,
                  name: exercise.exerciseName,
                  muscleGroupName: exercise.primaryMuscleGroupName || undefined,
                })}
              />
            ))}
          </NativeList>
        </NativeSection>
      ) : null}
    </div>
  );
}

function OverviewTab({ page, overview }: { page: AnalyticsPage; overview: AnalyticsOverview }) {
  const { state, actions } = page;
  const total = formatTons(overview.totalVolumeKg);

  return (
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
        onSelectExercise={actions.openExercise}
      />

      <NativeSection title="Volume trend" className="an-wide">
        <NativeCard className="an-chart-card">
          <div className="an-total">
            <span>Total volume</span>
            <b>
              {total.value}
              <small> {total.unit}</small>
            </b>
          </div>

          <div className="an-chart">
            <LineChart
              points={state.volumePoints}
              valueSuffix=" kg"
              emptyText="Complete workouts to see your volume trend."
            />
          </div>
        </NativeCard>
      </NativeSection>
    </div>
  );
}

function RecordsTab({ page }: { page: AnalyticsPage }) {
  const { state, actions } = page;

  return (
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
              subtitle={[
                record.primaryMuscleGroupName,
                record.bestEstimatedOneRepMax != null
                  ? `e1RM ${formatKg(record.bestEstimatedOneRepMax)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              value={record.bestWeightKg != null ? formatKg(record.bestWeightKg) : "—"}
              onClick={() => actions.openExercise({
                id: record.exerciseId,
                name: record.exerciseName,
                muscleGroupName: record.primaryMuscleGroupName || undefined,
              })}
            />
          ))}
        </NativeList>
      )}
    </NativeSection>
  );
}
