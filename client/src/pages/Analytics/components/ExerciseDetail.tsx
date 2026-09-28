import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  LuCalendarDays,
  LuChevronRight,
  LuDumbbell,
  LuFlame,
  LuLayers,
  LuRepeat,
  LuTrendingDown,
  LuTrendingUp,
  LuTrophy,
  LuWeight,
} from "react-icons/lu";
import {
  AsyncSection,
  LineChart,
  NativeCard,
  NativeGlyph,
  NativeList,
  NativeRow,
  NativeSection,
  NativeStat,
  NativeStatGrid,
  SegmentControl,
  SegmentControlSize,
  type LineChartPoint,
  type NativeTint,
} from "@/shared/components";
import type { ExerciseProgression, ExerciseRecord, ExerciseSession } from "@/types";
import type { AnalyticsExerciseSelection, ProgressionChange, ProgressionMetric } from "../types";
import {
  formatKg,
  formatSessionDate,
  formatSessionSet,
  formatVolume,
  formatWeightTimesReps,
} from "../utils/analyticsFormat";

const METRIC_OPTIONS: { label: string; value: ProgressionMetric }[] = [
  { label: "Est. 1RM", value: "oneRepMax" },
  { label: "Top weight", value: "topWeight" },
  { label: "Volume", value: "volume" },
];

const SESSION_PAGE_SIZE = 8;

type ExerciseDetailProps = {
  exercise: AnalyticsExerciseSelection;
  progression: ExerciseProgression | null;
  isLoading: boolean;
  error: string | null;
  metric: ProgressionMetric;
  points: LineChartPoint[];
  change: ProgressionChange | null;
  onRetry: () => void;
  onMetricChange: (metric: ProgressionMetric) => void;
  onChangeExercise: () => void;
};

export function ExerciseDetail({
  exercise,
  progression,
  isLoading,
  error,
  metric,
  points,
  change,
  onRetry,
  onMetricChange,
  onChangeExercise,
}: ExerciseDetailProps) {
  return (
    <div className="an-exercise">
      <NativeCard className="an-exercise-head">
        {exercise.imageUrl ? (
          <img src={exercise.imageUrl} alt="" className="an-exercise-image" loading="lazy" />
        ) : (
          <NativeGlyph tint="orange" size="lg">
            <LuDumbbell className="h-6 w-6" />
          </NativeGlyph>
        )}
        <div className="an-exercise-title">
          <h2>{exercise.name}</h2>
          {exercise.muscleGroupName ? <p>{exercise.muscleGroupName}</p> : null}
        </div>
        <button type="button" onClick={onChangeExercise} className="an-exercise-change liquid-pill">
          Change
        </button>
      </NativeCard>

      <AsyncSection
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        loadingLabel="Loading exercise..."
      >
        {progression ? (
          progression.summary.sessionCount === 0 ? (
            <NativeCard>
              <p className="an-empty">
                No completed sets for {exercise.name} in this range. Try a longer range.
              </p>
            </NativeCard>
          ) : (
            <div className="an-exercise-body">
              <ExerciseStats progression={progression} />

              <NativeSection title="Progress">
                <NativeCard className="an-chart-card">
                  <SegmentControl
                    value={metric}
                    options={METRIC_OPTIONS}
                    onChange={onMetricChange}
                    size={SegmentControlSize.Sm}
                  />
                  <ChangeBadge change={change} />
                  <div className="an-chart">
                    <LineChart
                      points={points}
                      valueSuffix=" kg"
                      emptyText="Not enough data for this metric yet."
                      baseline={metric === "volume" ? "zero" : "data"}
                    />
                  </div>
                </NativeCard>
              </NativeSection>

              <PersonalRecords progression={progression} />

              <SessionHistory sessions={progression.sessions} />
            </div>
          )
        ) : null}
      </AsyncSection>
    </div>
  );
}

function ExerciseStats({ progression }: { progression: ExerciseProgression }) {
  const { summary, records } = progression;
  const bestOneRepMax = records.bestEstimatedOneRepMax;
  const heaviest = records.heaviestWeight;

  return (
    <NativeStatGrid>
      <NativeStat
        tint="orange"
        icon={<LuTrophy className="h-5 w-5" />}
        label="Best est. 1RM"
        value={bestOneRepMax ? formatKg(bestOneRepMax.value) : "—"}
        caption={bestOneRepMax ? formatSessionDate(bestOneRepMax.achievedOn) : "Log weight and reps"}
      />
      <NativeStat
        tint="purple"
        icon={<LuWeight className="h-5 w-5" />}
        label="Heaviest"
        value={heaviest ? formatKg(heaviest.value) : "—"}
        caption={heaviest?.reps != null ? `× ${heaviest.reps} reps` : undefined}
      />
      <NativeStat
        tint="green"
        icon={<LuLayers className="h-5 w-5" />}
        label="Sessions"
        value={summary.sessionCount.toLocaleString()}
        caption={`${summary.totalSets.toLocaleString()} sets · ${summary.totalReps.toLocaleString()} reps`}
      />
      <NativeStat
        tint="blue"
        icon={<LuCalendarDays className="h-5 w-5" />}
        label="Last trained"
        value={summary.lastTrainedOn ? formatSessionDate(summary.lastTrainedOn) : "—"}
        caption={summary.firstTrainedOn ? `First ${formatSessionDate(summary.firstTrainedOn)}` : undefined}
      />
    </NativeStatGrid>
  );
}

function ChangeBadge({ change }: { change: ProgressionChange | null }) {
  if (!change) {
    return null;
  }

  const direction = change.delta > 0 ? "up" : change.delta < 0 ? "down" : "flat";
  const sign = change.delta > 0 ? "+" : "";
  const percent = change.percent != null ? ` (${sign}${change.percent}%)` : "";

  return (
    <p className={`an-change an-change-${direction}`}>
      {direction === "down" ? (
        <LuTrendingDown className="h-4 w-4" aria-hidden="true" />
      ) : (
        <LuTrendingUp className="h-4 w-4" aria-hidden="true" />
      )}
      <b>
        {sign}
        {formatKg(change.delta)}
        {percent}
      </b>
      <span>since {change.since}</span>
    </p>
  );
}

type RecordRow = {
  key: string;
  label: string;
  tint: NativeTint;
  icon: ReactNode;
  record: ExerciseRecord | null | undefined;
  formatValue: (record: ExerciseRecord) => string;
  formatDetail?: (record: ExerciseRecord) => string;
};

function PersonalRecords({ progression }: { progression: ExerciseProgression }) {
  const { records } = progression;
  const rows: RecordRow[] = [
    {
      key: "heaviest",
      label: "Heaviest weight",
      tint: "purple",
      icon: <LuWeight className="h-5 w-5" />,
      record: records.heaviestWeight,
      formatValue: (record) => formatWeightTimesReps(record.value, record.reps),
    },
    {
      key: "one-rep-max",
      label: "Best est. 1RM",
      tint: "orange",
      icon: <LuTrophy className="h-5 w-5" />,
      record: records.bestEstimatedOneRepMax,
      formatValue: (record) => formatKg(record.value),
      formatDetail: (record) => formatWeightTimesReps(record.weightKg, record.reps),
    },
    {
      key: "most-reps",
      label: "Most reps",
      tint: "green",
      icon: <LuRepeat className="h-5 w-5" />,
      record: records.mostReps,
      formatValue: (record) => `${record.value} reps`,
      formatDetail: (record) => (record.weightKg != null ? `at ${formatKg(record.weightKg)}` : ""),
    },
    {
      key: "session-volume",
      label: "Best session volume",
      tint: "cyan",
      icon: <LuFlame className="h-5 w-5" />,
      record: records.bestSessionVolume,
      formatValue: (record) => formatVolume(record.value),
    },
  ];

  const present = rows.filter((row) => row.record != null);
  if (present.length === 0) {
    return null;
  }

  return (
    <NativeSection title="Personal records">
      <NativeList>
        {present.map((row) => {
          const record = row.record as ExerciseRecord;
          const detail = row.formatDetail?.(record);

          return (
            <NativeRow
              key={row.key}
              glyph={<NativeGlyph tint={row.tint}>{row.icon}</NativeGlyph>}
              title={row.label}
              subtitle={[detail, formatSessionDate(record.achievedOn)].filter(Boolean).join(" · ")}
              value={row.formatValue(record)}
            />
          );
        })}
      </NativeList>
    </NativeSection>
  );
}

function SessionHistory({ sessions }: { sessions: ExerciseSession[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sessions : sessions.slice(0, SESSION_PAGE_SIZE);
  const hiddenCount = sessions.length - visible.length;

  return (
    <NativeSection title="History">
      <div className="an-sessions">
        {visible.map((session) => (
          <SessionCard key={session.workoutId} session={session} />
        ))}
      </div>

      {hiddenCount > 0 || showAll ? (
        <button
          type="button"
          onClick={() => setShowAll((previous) => !previous)}
          className="an-sessions-toggle"
          aria-expanded={showAll}
        >
          {showAll ? "Show fewer sessions" : `Show all ${sessions.length} sessions`}
        </button>
      ) : null}
    </NativeSection>
  );
}

function SessionCard({ session }: { session: ExerciseSession }) {
  const topSetIndex = session.bestWeightKg != null
    ? session.sets.findIndex((set) => set.weightKg === session.bestWeightKg)
    : -1;

  return (
    <article className="an-session">
      <Link to={`/workouts/${session.workoutId}/summary`} className="an-session-head">
        <span className="an-session-copy">
          <b>{formatSessionDate(session.date)}</b>
          <small>{session.workoutTitle || "Workout"}</small>
        </span>
        {session.isPersonalRecord ? (
          <span className="an-pr-badge">
            <LuTrophy className="h-3 w-3" aria-hidden="true" />
            PR
          </span>
        ) : null}
        {session.totalVolumeKg > 0 ? (
          <strong className="an-session-volume">{formatVolume(session.totalVolumeKg)}</strong>
        ) : null}
        <LuChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </Link>

      <ul className="an-set-chips" aria-label="Sets">
        {session.sets.map((set, index) => (
          <li key={index} className={index === topSetIndex ? "is-top" : undefined}>
            {formatSessionSet(set)}
          </li>
        ))}
      </ul>
    </article>
  );
}
