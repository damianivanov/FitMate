import { LuCalendar, LuClock, LuDumbbell, LuEye, LuLock } from "react-icons/lu";
import type { WorkoutTemplate, WorkoutTemplateExercise } from "@/types";
import {
  formatTemplateDate,
  getTemplateDurationLabel,
  getTemplateVisibilityLabel,
} from "../utils/templateDisplay";

type TemplateListItemProps = {
  template: WorkoutTemplate;
  isSelected: boolean;
  onSelect: (templateId: number) => void;
};

function getTemplateExercises(template: WorkoutTemplate): WorkoutTemplateExercise[] {
  return template.groups
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((group) =>
      group.exercises
        .slice()
        .sort((left, right) => left.orderIndex - right.orderIndex));
}

function getExerciseDisplayName(exercise: WorkoutTemplateExercise): string {
  return exercise.exerciseName || `Exercise #${exercise.exerciseId}`;
}

export function TemplateListItem({
  template,
  isSelected,
  onSelect,
}: TemplateListItemProps) {
  const createdDateLabel = formatTemplateDate(template.dateCreated);
  const visibilityLabel = getTemplateVisibilityLabel(template);
  const VisibilityIcon = template.isPublic ? LuEye : LuLock;
  const templateExercises = getTemplateExercises(template);
  const imageTemplateExercises = templateExercises.filter((exercise) => exercise.exerciseImageUrl);
  const visibleTemplateExercises = imageTemplateExercises.slice(0, 6);
  const hiddenTemplateExerciseCount = imageTemplateExercises.length - visibleTemplateExercises.length;
  const exerciseNames = templateExercises.map(getExerciseDisplayName);

  const handleTemplateSelect = () => {
    onSelect(template.id);
  };

  return (
    <button
      type="button"
      onClick={handleTemplateSelect}
      className={[
        "liquid-panel w-full cursor-pointer rounded-2xl p-4 text-left transition",
        isSelected ? "border-primary-300 bg-primary-100/15" : "hover:-translate-y-0.5 hover:border-primary-300/60",
      ].join(" ")}
      aria-pressed={isSelected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-foreground">{template.name}</h2>
          {template.description ? (
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-secondary">
              {template.description}
            </p>
          ) : null}
        </div>
        <span className="liquid-primary-chip inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold">
          {template.exerciseCount} exercise{template.exerciseCount === 1 ? "" : "s"}
        </span>
      </div>

      {templateExercises.length > 0 ? (
        <div className="mt-4 space-y-2">
          {visibleTemplateExercises.length > 0 ? (
            <div className="flex flex-wrap items-center gap-0 sm:gap-2">
              {visibleTemplateExercises.map((exercise) => (
                <span
                  key={exercise.id}
                  className="inline-flex h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-(--glass-divider) bg-(--glass-bg-soft) -ml-2 first:ml-0"
                >
                  <img
                    src={exercise.exerciseImageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </span>
              ))}
              {hiddenTemplateExerciseCount > 0 ? (
                <span className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-(--glass-divider) bg-(--glass-bg-soft) -ml-2 px-2 text-xs font-semibold text-secondary">
                  +{hiddenTemplateExerciseCount}
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="line-clamp-2 text-xs leading-snug text-secondary">
            {exerciseNames.join(", ")}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex min-w-0 items-center gap-3 overflow-hidden text-xs text-secondary sm:gap-4">
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <LuDumbbell className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="whitespace-nowrap">{template.setCount} sets</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <LuClock className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="whitespace-nowrap">{getTemplateDurationLabel(template)}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <VisibilityIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="whitespace-nowrap">{visibilityLabel}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <LuCalendar className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="whitespace-nowrap">{createdDateLabel}</span>
        </span>
      </div>
    </button>
  );
}
