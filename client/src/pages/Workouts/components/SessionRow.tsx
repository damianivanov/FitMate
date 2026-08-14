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
import { ExerciseChip } from "./ExerciseChip";

type SessionRowProps = {
  workout: Workout;
  isDeleting: boolean;
  onOpen: (workout: Workout) => void;
  onDelete: (workout: Workout) => void;
  onRepeat: (workout: Workout) => void;
  onSaveAsTemplate: (workout: Workout) => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

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

  // The date moves in here now that the tile is gone — it is context for the title rather
  // than a column you scan down.
  const meta = [
    date ? DATE_FORMATTER.format(date) : null,
    `${workout.setCount} set${workout.setCount === 1 ? "" : "s"}`,
    formatDuration(workout.durationSeconds),
    status === "in-progress" ? "In progress" : status === "not-started" ? "Not started" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const exercises = workout.groups
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((group) =>
      group.exercises.slice().sort((left, right) => left.orderIndex - right.orderIndex),
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
    <article className="wk-card">
      {/* The title gets the full width of the card and the status rides on a coloured stripe
          beside it, so the name is the first and largest thing read — the date tile used to
          take the room the title needed to be legible at a glance. */}
      <div className="wk-card-head">
        <button
          type="button"
          className="wk-card-open"
          onClick={() => onOpen(workout)}
          aria-label={`Open ${title}`}
        >
          <span className={`wk-card-rail state-${status}`} aria-hidden="true" />
          <span className="wk-card-copy">
            <b>{title}</b>
            <small>{meta}</small>
          </span>
          {isFinished ? (
            <span className="wk-card-check" aria-hidden="true">
              <LuCheck className="h-4 w-4" strokeWidth={3} />
            </span>
          ) : null}
        </button>

        <ActionMenu triggerAriaLabel={`${title} actions`} items={menuItems} />
      </div>

      {/* Every exercise, scrolling rather than truncated to a count: the pictures are the
          quickest way to recognise a session, and a "+3" hides exactly the ones you might
          be looking for. */}
      {exercises.length > 0 ? (
        <div className="wk-card-strip">
          {exercises.map((exercise) => (
            <ExerciseChip key={exercise.id} exercise={exercise} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
