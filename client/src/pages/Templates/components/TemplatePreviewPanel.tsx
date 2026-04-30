import { LuClock, LuDumbbell, LuEye, LuLock, LuPencil, LuPlay, LuRepeat } from "react-icons/lu";
import { useMatch, useNavigate } from "react-router-dom";
import { ExerciseGroupType, type WorkoutTemplate, type WorkoutTemplateExercise } from "@/types";
import {
  formatTemplateDate,
  getTemplateDurationLabel,
  getTemplateGroupSummary,
  getTemplateGroupTypeLabel,
  getTemplateVisibilityLabel,
} from "../utils/templateDisplay";

type TemplatePreviewPanelProps = {
  template: WorkoutTemplate | null;
};

const TEMPLATE_VIEW_ROUTE_PATTERN = "/templates/view/:templateId";

function formatMetricValue(value: number | null | undefined): string {
  if (value == null) {
    return "";
  }

  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");
}

function formatExerciseTarget(exercise: WorkoutTemplateExercise): string {
  const firstSet = exercise.sets[0];
  if (!firstSet) {
    return `${exercise.targetSets} sets`;
  }

  const weight = formatMetricValue(firstSet.weightKg);
  const reps = formatMetricValue(firstSet.reps);
  const duration = formatMetricValue(firstSet.durationSeconds);

  if (weight && reps) {
    return `${exercise.sets.length} x ${weight} kg x ${reps}`;
  }

  if (reps) {
    return `${exercise.sets.length} x ${reps} reps`;
  }

  if (duration) {
    return `${exercise.sets.length} x ${duration}s`;
  }

  return `${exercise.sets.length} sets`;
}

export function TemplatePreviewPanel({
  template,
}: TemplatePreviewPanelProps) {
  const navigate = useNavigate();
  const isTemplateViewRoute = Boolean(useMatch(TEMPLATE_VIEW_ROUTE_PATTERN));
  const showHeaderActions = !isTemplateViewRoute;

  const handleEditClick = () => {
    if (!template) {
      return;
    }

    navigate(`/templates/${template.id}`);
  };

  const handleStartClick = () => {
    if (!template) {
      return;
    }

    console.log("Start workout from template", template);
  };

  if (!template) {
    const emptyStateClassName = [
      "flex min-h-80 items-center justify-center p-6 text-center",
      "liquid-panel rounded-2xl",
    ].join(" ");

    return (
      <aside className={emptyStateClassName}>
        <div>
          <p className="text-sm font-semibold text-foreground">No template selected</p>
          <p className="mt-1 text-sm text-secondary">Your saved templates will appear here.</p>
        </div>
      </aside>
    );
  }

  const createdDateLabel = formatTemplateDate(template.dateCreated);
  const visibilityLabel = getTemplateVisibilityLabel(template);
  const VisibilityIcon = template.isPublic ? LuEye : LuLock;
  const previewClassName = [
    "liquid-panel rounded-2xl p-4 md:p-5",
    isTemplateViewRoute ? "" : "md:sticky md:top-0",
  ].join(" ");

  return (
    <aside className={previewClassName}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold leading-tight text-foreground">{template.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            {template.description || "No description"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showHeaderActions ? (
            <button
              type="button"
              onClick={handleStartClick}
              className="liquid-primary-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
            >
              <LuPlay className="h-4 w-4" />
              <span>Start</span>
            </button>
          ) : null}
          {showHeaderActions ? (
            <button
              type="button"
              onClick={handleEditClick}
              className="liquid-pill inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
            >
              <LuPencil className="h-4 w-4" />
              <span>Edit</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2 md:mt-5 grid grid-cols-2 gap-2">
        <div className="liquid-info-surface rounded-2xl px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Exercises</p>
          <p className="mt-1 text-lg font-bold text-foreground">{template.exerciseCount}</p>
        </div>
        <div className="liquid-info-surface rounded-2xl px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Sets</p>
          <p className="mt-1 text-lg font-bold text-foreground">{template.setCount}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-secondary sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <span className="liquid-pill inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-2">
          <LuClock className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{getTemplateDurationLabel(template)}</span>
        </span>
        <span className="liquid-pill inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-2">
          <VisibilityIcon className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{visibilityLabel}</span>
        </span>
        <span className="liquid-pill inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-2">
          <LuDumbbell className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{createdDateLabel}</span>
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {template.groups.map((group) => {
          const isGrouped = group.groupType !== ExerciseGroupType.Straight;

          return (
            <section key={group.id} className="liquid-info-surface rounded-2xl px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {getTemplateGroupSummary(group)}
                  </p>
                  <p className="mt-0.5 text-xs text-secondary">
                    {group.exercises.length} exercise{group.exercises.length === 1 ? "" : "s"}
                  </p>
                </div>
                {isGrouped ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-100/25 px-2.5 py-1 text-xs font-semibold text-primary">
                    <LuRepeat className="h-3.5 w-3.5" />
                    {getTemplateGroupTypeLabel(group.groupType)}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                {group.exercises.map((exercise) => (
                  <div key={exercise.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {exercise.exerciseImageUrl ? (
                        <img
                          src={exercise.exerciseImageUrl}
                          alt=""
                          loading="lazy"
                          className="h-9 w-9 shrink-0 rounded-lg object-cover"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-secondary">
                        {exercise.exerciseName || `Exercise #${exercise.exerciseId}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-muted">
                      {formatExerciseTarget(exercise)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
