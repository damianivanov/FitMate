import {
  LuCheck,
  LuLayoutTemplate,
  LuLoaderCircle,
  LuRepeat2,
  LuTrash2,
} from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import { ActionMenu, type ActionMenuItem } from "@/shared/components";
import type { Workout } from "@/types";

type SessionRowProps = {
  workout: Workout;
  isDeleting: boolean;
  onOpen: (workout: Workout) => void;
  onDelete: (workout: Workout) => void;
  onRepeat: (workout: Workout) => void;
  onSaveAsTemplate: (workout: Workout) => void;
};

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: "short" });

type SessionStatus = "finished" | "in-progress" | "not-started";

function resolveStatus(workout: Workout): SessionStatus {
  if (workout.finishedAt) {
    return "finished";
  }

  return workout.startedAt ? "in-progress" : "not-started";
}

function resolveDate(workout: Workout): Date | null {
  const value = workout.finishedAt ?? workout.startedAt;

  if (!value) {
    return null;
  }

  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds <= 0) {
    return null;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes} min`;
}

export function SessionRow({
  workout,
  isDeleting,
  onOpen,
  onDelete,
  onRepeat,
  onSaveAsTemplate,
}: SessionRowProps) {
  const status = resolveStatus(workout);
  const isFinished = status === "finished";
  const date = resolveDate(workout);
  const title = workout.title.trim() || "Untitled workout";

  const meta = [
    `${workout.setCount} set${workout.setCount === 1 ? "" : "s"}`,
    formatDuration(workout.durationSeconds),
    status === "in-progress" ? "In progress" : status === "not-started" ? "Not started" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const exerciseNames = workout.groups
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((group) =>
      group.exercises
        .slice()
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((exercise) => exercise.exerciseName || `Exercise #${exercise.exerciseId}`),
    );

  const menuItems: ActionMenuItem[] = [];

  if (isFinished) {
    menuItems.push({
      key: "repeat",
      label: "Repeat workout",
      icon: <LuRepeat2 className="h-4 w-4 shrink-0" />,
      onSelect: () => onRepeat(workout),
      variant: "primary",
    });
    menuItems.push({
      key: "save-as-template",
      label: "Save as template",
      icon: <LuLayoutTemplate className="h-4 w-4 shrink-0" />,
      onSelect: () => onSaveAsTemplate(workout),
    });
  }

  menuItems.push({
    key: "delete",
    label: "Delete",
    icon: isDeleting ? (
      <LuLoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
    ) : (
      <LuTrash2 className="h-4 w-4 shrink-0" />
    ),
    onSelect: () => onDelete(workout),
    variant: "danger",
    disabled: isDeleting,
  });

  return (
    <article className="wk-row">
      <button
        type="button"
        className="wk-row-open"
        onClick={() => onOpen(workout)}
        aria-label={`Open ${title}`}
      >
        {/* Tinted by state rather than for decoration: green reads as done at a glance, which
            is the one thing you scan this list for. */}
        <span className={`wk-date-tile state-${status}`}>
          <small>{date ? WEEKDAY_FORMATTER.format(date) : "—"}</small>
          <b>{date ? date.getDate() : "·"}</b>
        </span>

        <span className="wk-row-copy">
          <b>{title}</b>
          <small>{meta}</small>
          {exerciseNames.length > 0 ? (
            <span className="wk-row-chips">
              {exerciseNames.slice(0, 3).map((name) => (
                <i key={name}>{name}</i>
              ))}
              {exerciseNames.length > 3 ? <i>+{exerciseNames.length - 3}</i> : null}
            </span>
          ) : null}
        </span>

        {isFinished ? (
          <span className="wk-row-check" aria-hidden="true">
            <LuCheck className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : null}
      </button>

      <ActionMenu triggerAriaLabel={`${title} actions`} items={menuItems} />
    </article>
  );
}
