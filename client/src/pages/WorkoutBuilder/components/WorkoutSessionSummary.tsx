import { useState, type ChangeEvent } from "react";
import {
  LuArrowDownUp,
  LuCheck,
  LuChevronDown,
  LuClock,
  LuDumbbell,
  LuListChecks,
  LuNotebookPen,
} from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import type { WorkoutSummary } from "../utils/workoutDraft";
import { formatElapsedTime, formatMetricValue } from "../utils/workoutDraft";

type WorkoutSessionSummaryProps = {
  templateName: string;
  startedAt?: string;
  notes: string;
  elapsedSeconds: number;
  summary: WorkoutSummary;
  showReorderToggle?: boolean;
  isReorderMode?: boolean;
  onToggleReorderMode?: () => void;
  onNotesChange: (value: string) => void;
  onNotesCommit: () => void;
};

const STARTED_AT_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

function formatStartedAt(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(normalizeUtcIsoString(value));
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return STARTED_AT_FORMATTER.format(date);
}

export function WorkoutSessionSummary({
  templateName,
  startedAt,
  notes,
  elapsedSeconds,
  summary,
  showReorderToggle = false,
  isReorderMode = false,
  onToggleReorderMode,
  onNotesChange,
  onNotesCommit,
}: WorkoutSessionSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const startedAtLabel = formatStartedAt(startedAt);
  const hasTotalVolume = summary.totalVolumeKg != null;
  const totalVolumeLabel = summary.totalVolumeKg == null
    ? "-"
    : `${formatMetricValue(summary.totalVolumeKg)} kg`;

  const handleSummaryToggle = () => {
    setIsExpanded((current) => !current);
  };

  const handleNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onNotesChange(event.target.value);
  };

  const handleNotesBlur = () => {
    onNotesCommit();
  };

  return (
    <aside className="liquid-panel rounded-2xl p-1.5 md:rounded-lg md:p-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleSummaryToggle}
          className="grid min-w-0 flex-1 cursor-pointer grid-cols-[auto_1fr] items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/8 md:flex md:gap-4"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Hide workout details" : "Show workout details"}
        >
          <span className="min-w-24 shrink-0 text-lg font-bold tabular-nums text-primary md:min-w-0 md:text-base">
            {formatElapsedTime(elapsedSeconds)}
          </span>
          <span className="flex min-w-0 items-center gap-3 overflow-hidden text-sm font-semibold text-muted md:text-base">
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap" title="Completed sets">
              <LuListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {summary.completedSetCount}/{summary.totalSetCount}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap" title="Exercises">
              <LuDumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {summary.exerciseCount}
            </span>
            {hasTotalVolume ? (
              <span className="hidden min-w-0 truncate whitespace-nowrap sm:inline">
                {totalVolumeLabel}
              </span>
            ) : null}
          </span>
        </button>

        {showReorderToggle ? (
          <button
            type="button"
            onClick={onToggleReorderMode}
            className={
              isReorderMode
                ? "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary-100 px-3 text-sm font-semibold text-primary-900 transition hover:bg-primary-100"
                : "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition hover:bg-white/8 hover:text-primary"
            }
            aria-pressed={isReorderMode}
            aria-label={isReorderMode ? "Finish reordering exercises" : "Reorder exercises"}
            title={isReorderMode ? "Finish reordering" : "Reorder exercises"}
          >
            {isReorderMode ? (
              <>
                <LuCheck className="h-4 w-4" />
                <span>Done</span>
              </>
            ) : (
              <LuArrowDownUp className="h-4 w-4" />
            )}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleSummaryToggle}
          tabIndex={-1}
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition hover:bg-white/8 hover:text-primary"
        >
          <LuChevronDown
            className={[
              "h-4 w-4 transition-transform",
              isExpanded ? "rotate-180" : "rotate-0",
            ].join(" ")}
          />
        </button>
      </div>

      {isExpanded ? (
        <div className="px-2 pb-2 pt-3 md:px-3 md:pb-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 truncate text-base font-extrabold text-foreground md:text-lg">
              {templateName}
            </h2>
            <span className="liquid-primary-chip inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
              <LuClock className="h-3.5 w-3.5" />
              {startedAtLabel || "Not started"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="liquid-info-surface rounded-xl px-3 py-2.5">
              <p className="text-2xs font-semibold uppercase tracking-widest text-muted">Sets</p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {summary.completedSetCount}/{summary.totalSetCount}
              </p>
            </div>
            <div className="liquid-info-surface rounded-xl px-3 py-2.5">
              <p className="text-2xs font-semibold uppercase tracking-widest text-muted">Exercises</p>
              <p className="mt-1 text-lg font-bold text-foreground">{summary.exerciseCount}</p>
            </div>
            <div className="liquid-info-surface rounded-xl px-3 py-2.5">
              <p className="text-2xs font-semibold uppercase tracking-widest text-muted">Volume</p>
              <p className="mt-1 text-lg font-bold text-foreground">{totalVolumeLabel}</p>
            </div>
          </div>

          <label className="mt-3 block">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
              <LuNotebookPen className="h-3.5 w-3.5 text-primary" />
              Notes
            </span>
            <textarea
              value={notes}
              onChange={handleNotesChange}
              onBlur={handleNotesBlur}
              rows={4}
              className="liquid-input w-full resize-none rounded-xl px-4 py-3 text-sm leading-relaxed text-foreground"
            />
          </label>
        </div>
      ) : null}
    </aside>
  );
}
