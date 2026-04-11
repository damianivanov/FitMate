import { useMemo } from "react";
import { ExerciseGroupType } from "@/types";
import type {
  TemplateBuilderExerciseDraftModel as TemplateExerciseDraft,
  TemplateBuilderExerciseIndexItem,
} from "../models/templateBuilderDraft";

type MuscleDistributionItem = {
  muscle: string;
  percentage: number;
};

type TemplateBuilderSidebarProps = {
  templateName: string;
  durationMinutes: number;
  isPublic: boolean;
  exercises: readonly TemplateExerciseDraft[];
  exerciseIndexById: ReadonlyMap<number, TemplateBuilderExerciseIndexItem>;
  getExerciseDisplayName: (exerciseId: number) => string;
};

function getArrangementLabel(groupType: ExerciseGroupType): string {
  if (groupType === ExerciseGroupType.Straight) {
    return "Single";
  }

  if (groupType === ExerciseGroupType.Superset) {
    return "Superset";
  }

  return "Circuit";
}

function getArrangementAccent(groupType: ExerciseGroupType): string {
  if (groupType === ExerciseGroupType.Circuit) {
    return "linear-gradient(180deg, var(--color-primary) 0%, var(--color-accent-500) 50%, var(--color-mint-400) 100%)";
  }

  if (groupType === ExerciseGroupType.Superset) {
    return "linear-gradient(180deg, var(--color-primary) 0%, var(--color-accent-500) 100%)";
  }

  return "var(--color-primary)";
}

function getMuscleDistributionColor(index: number): string {
  if (index === 0) {
    return "var(--color-primary)";
  }

  if (index === 1) {
    return "var(--color-accent-500)";
  }

  return "var(--color-mint-400)";
}

export function TemplateBuilderSidebar({
  templateName,
  durationMinutes,
  isPublic,
  exercises,
  exerciseIndexById,
  getExerciseDisplayName,
}: TemplateBuilderSidebarProps) {
  const exerciseCount = exercises.length;
  const totalSets = useMemo(
    () => exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    [exercises],
  );
  const groupedExerciseCount = useMemo(
    () => exercises.filter((exercise) => exercise.groupType !== ExerciseGroupType.Straight).length,
    [exercises],
  );
  const muscleDistribution = useMemo<MuscleDistributionItem[]>(() => {
    const muscleTotals = new Map<string, number>();

    exercises.forEach((exercise) => {
      const primaryMuscleGroupName = exerciseIndexById.get(exercise.exerciseId)?.primaryMuscleGroupName ?? "Unknown";
      const current = muscleTotals.get(primaryMuscleGroupName) ?? 0;
      muscleTotals.set(primaryMuscleGroupName, current + exercise.sets.length);
    });

    const total = Array.from(muscleTotals.values()).reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return [];
    }

    return Array.from(muscleTotals.entries())
      .map(([muscle, setCount]) => ({
        muscle,
        percentage: Math.round((setCount / total) * 100),
      }))
      .sort((left, right) => right.percentage - left.percentage)
      .slice(0, 4);
  }, [exerciseIndexById, exercises]);
  const secondarySummaryText = useMemo(() => {
    if (!muscleDistribution.length) {
      return "Full Body";
    }

    return muscleDistribution
      .slice(0, 3)
      .map((item) => item.muscle)
      .join(", ");
  }, [muscleDistribution]);
  const trimmedTemplateName = templateName.trim();

  return (
    <aside className="space-y-5 xl:sticky xl:self-start">
      <section className="liquid-template-preview rounded-3xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Preview</h2>
        <div className="mt-4">
          <div className="mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {isPublic ? "Public" : "Private"} - ~{durationMinutes} min
          </div>
          <p className="mt-1.5 text-xl font-bold text-foreground">{trimmedTemplateName}</p>
          <p className="mt-1 text-xs text-secondary">{secondarySummaryText}</p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="liquid-template-stat rounded-xl p-2.5 text-center">
              <div className="text-lg font-bold text-foreground">{exerciseCount}</div>
              <div className="text-xs uppercase text-secondary">Exercises</div>
            </div>
            <div className="liquid-template-stat rounded-xl p-2.5 text-center">
              <div className="text-lg font-bold text-foreground">{groupedExerciseCount}</div>
              <div className="text-xs uppercase text-secondary">Groups</div>
            </div>
            <div className="liquid-template-stat rounded-xl p-2.5 text-center">
              <div className="text-lg font-bold text-foreground">{totalSets}</div>
              <div className="text-xs uppercase text-secondary">Sets</div>
            </div>
          </div>
        </div>
      </section>

      <section className="liquid-panel rounded-3xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Exercise List</h2>
        <div className="mt-3 space-y-2">
          {exercises.map((exercise) => {
            const exerciseDisplayName = getExerciseDisplayName(exercise.exerciseId);

            return (
              <div key={`summary-${exercise.id}`} className="liquid-input rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-1 rounded-full"
                    style={{
                      background: getArrangementAccent(exercise.groupType),
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{exerciseDisplayName}</p>
                    <p className="text-xs text-secondary">
                      {exercise.sets.length} sets - {getArrangementLabel(exercise.groupType)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="liquid-panel rounded-3xl p-5">
        <h2 className="text-sm font-semibold text-foreground">Muscles</h2>
        <div className="mt-3 space-y-3">
          {muscleDistribution.map((item, index) => (
            <div key={item.muscle}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-secondary">{item.muscle}</span>
                <span className="text-muted">{item.percentage}%</span>
              </div>
              <div className="liquid-progress-track h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: getMuscleDistributionColor(index),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
