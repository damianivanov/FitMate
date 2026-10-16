import { LuHistory, LuPlus } from "react-icons/lu";
import { formatDate, normalizeUtcIsoString } from "@/lib/helpers";
import type { ExerciseHistory } from "@/types";
import { Modal } from "../Modal";
import { formatPreviousSetLabel } from "./format";

type PreviousSetsModalProps = {
  isOpen: boolean;
  history: ExerciseHistory;
  exerciseName: string;
  onClose: () => void;
  onApplySession: (workoutId: number) => void;
};

export function PreviousSetsModal({
  isOpen,
  history,
  exerciseName,
  onClose,
  onApplySession,
}: PreviousSetsModalProps) {
  const sessions = history.sessions;
  const headingLabel = sessions.length <= 1 ? "Last time" : `Last ${sessions.length} times`;

  const handleAddClick = (workoutId: number) => {
    onApplySession(workoutId);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={exerciseName}
      titleIcon={<LuHistory className="h-4 w-4" />}
      maxWidth="sm"
    >
      <div className="px-5 pb-5 pt-1">
        <p className="mb-3 text-2xs font-semibold uppercase tracking-widest text-muted">
          {headingLabel}
        </p>

        <div className="liquid-scrollbar flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {sessions.map((session, sessionIndex) => (
            <div
              key={session.workoutId}
              className={sessionIndex > 0 ? "liquid-divider border-t pt-3" : ""}
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground" title={session.workoutTitle}>
                    {session.workoutTitle}
                  </p>
                  <p className="text-2xs font-medium text-secondary">
                    {formatDate(normalizeUtcIsoString(session.workoutStartedAt))} · Exercise #{session.exercisePosition}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddClick(session.workoutId)}
                  className="relative flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-primary-300 bg-primary-100/10 px-2.5 text-2xs font-semibold text-[var(--menu-item-primary-fg)] transition before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:bg-[var(--menu-item-primary-hover-bg)]"
                  aria-label={`Reuse sets from ${session.workoutTitle}, exercise ${session.exercisePosition}`}
                >
                  <LuPlus aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>
              <ul className="flex flex-col gap-1.5">
                {session.sets.map((set) => (
                  <li
                    key={set.setNumber}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="mono text-2xs font-semibold text-[var(--menu-item-primary-fg)]">
                      #{set.setNumber}
                    </span>
                    <span className="font-semibold tabular-nums text-secondary">
                      {formatPreviousSetLabel(set) ?? "-"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
