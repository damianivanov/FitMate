import { LuDumbbell, LuTrophy } from "react-icons/lu";
import { NativeList, NativeRow, NativeSection } from "@/shared/components";
import type { FrequentExerciseSummary, PersonalRecordSummary } from "@/types";
import type { AnalyticsExerciseSelection } from "../types";
import { formatKg } from "../utils/analyticsFormat";

type TrainingHighlightsProps = {
  frequentExercises: FrequentExerciseSummary[];
  personalRecords: PersonalRecordSummary[];
  onSelectExercise: (exercise: AnalyticsExerciseSelection) => void;
};

const HIGHLIGHT_LIMIT = 3;

function formatCount(value: number, singular: string, plural: string): string {
  return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}

function formatPersonalBest(record: PersonalRecordSummary): string {
  if (record.bestWeightKg != null) {
    return formatKg(record.bestWeightKg);
  }

  if (record.bestReps != null) {
    return formatCount(record.bestReps, "rep", "reps");
  }

  if (record.bestEstimatedOneRepMax != null) {
    return `${formatKg(record.bestEstimatedOneRepMax)} e1RM`;
  }

  return "Best set";
}

export function TrainingHighlights({
  frequentExercises,
  personalRecords,
  onSelectExercise,
}: TrainingHighlightsProps) {
  const topFrequentExercises = frequentExercises.slice(0, HIGHLIGHT_LIMIT);
  const topPersonalRecords = personalRecords.slice(0, HIGHLIGHT_LIMIT);

  return (
    <NativeSection title="Training highlights" className="an-highlights">
      <div className="an-highlights-grid">
        <section className="an-highlight-group" aria-labelledby="frequent-exercises-title">
          <h3 id="frequent-exercises-title">
            <LuDumbbell aria-hidden="true" />
            Frequently trained
          </h3>

          {topFrequentExercises.length > 0 ? (
            <NativeList className="an-highlight-list">
              {topFrequentExercises.map((exercise) => (
                <NativeRow
                  key={exercise.exerciseId}
                  title={exercise.exerciseName}
                  subtitle={[
                    exercise.primaryMuscleGroupName,
                    formatCount(exercise.setCount, "set", "sets"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  value={formatCount(exercise.workoutCount, "workout", "workouts")}
                  onClick={() => onSelectExercise({
                    id: exercise.exerciseId,
                    name: exercise.exerciseName,
                    muscleGroupName: exercise.primaryMuscleGroupName || undefined,
                  })}
                />
              ))}
            </NativeList>
          ) : (
            <p className="an-highlight-empty">Complete a workout to build your favourites.</p>
          )}
        </section>

        <section className="an-highlight-group" aria-labelledby="personal-bests-title">
          <h3 id="personal-bests-title">
            <LuTrophy aria-hidden="true" />
            Personal bests
          </h3>

          {topPersonalRecords.length > 0 ? (
            <NativeList className="an-highlight-list">
              {topPersonalRecords.map((record) => (
                <NativeRow
                  key={record.exerciseId}
                  title={record.exerciseName}
                  subtitle={record.primaryMuscleGroupName || "Personal record"}
                  value={formatPersonalBest(record)}
                  onClick={() => onSelectExercise({
                    id: record.exerciseId,
                    name: record.exerciseName,
                    muscleGroupName: record.primaryMuscleGroupName || undefined,
                  })}
                />
              ))}
            </NativeList>
          ) : (
            <p className="an-highlight-empty">Your best completed sets will appear here.</p>
          )}
        </section>
      </div>
    </NativeSection>
  );
}
