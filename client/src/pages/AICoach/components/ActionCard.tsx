import { Link } from "react-router";
import { LuCheck, LuListChecks, LuPlus, LuTriangleAlert, LuX } from "react-icons/lu";
import { AIActionStatus, AIActionType, type AIActionModel, type ActiveWorkoutModel } from "@/types";

const STATUS_LABELS: Record<number, string> = {
  [AIActionStatus.PendingConfirmation]: "Needs your confirmation",
  [AIActionStatus.Confirmed]: "Confirmed",
  [AIActionStatus.Executing]: "Applying...",
  [AIActionStatus.Executed]: "Created",
  [AIActionStatus.Rejected]: "Dismissed",
  [AIActionStatus.Expired]: "Expired",
  [AIActionStatus.Failed]: "Could not be applied",
};

/** Only these carry exercises and sets, so only these have anything to show in the detail view. */
const DETAILED_ACTION_TYPES = new Set<AIActionType>([
  AIActionType.CreateWorkout,
  AIActionType.CreateWorkoutTemplate,
]);

/**
 * A created program is a draft, so send the user straight to it — activation is theirs to do.
 * Everything else lands on its list page.
 */
function resultLink(entityKind: string, entityId: number) {
  return entityKind === "program" && entityId
    ? { to: `/program/${entityId}`, label: "Review & activate" }
    : { to: `/${entityKind}`, label: "View" };
}

type ActionCardProps = {
  action: AIActionModel;
  isBusy: boolean;
  activeWorkout: ActiveWorkoutModel | null;
  onConfirm: (actionId: number) => Promise<void>;
  onReject: (actionId: number) => Promise<void>;
  onMergeIntoActiveWorkout: (actionId: number) => Promise<void>;
  onViewDetail: (actionId: number) => void;
};

export function ActionCard({
  action,
  isBusy,
  activeWorkout,
  onConfirm,
  onReject,
  onMergeIntoActiveWorkout,
  onViewDetail,
}: ActionCardProps) {
  const isPending = action.status === AIActionStatus.PendingConfirmation;
  const isExecuted = action.status === AIActionStatus.Executed;
  const hasDetail = DETAILED_ACTION_TYPES.has(action.actionType);
  const { preview, validationSummary } = action;

  // Offering "add to what I'm doing" only makes sense for a workout, and only while one is running.
  const mergeTarget =
    isPending && action.actionType === AIActionType.CreateWorkout ? activeWorkout : null;

  // A resolved card is history: it stays in the thread for context but gives back its space.
  if (!isPending) {
    return (
      <section className="liquid-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3 md:rounded-lg">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{preview.title}</p>
          <p className="text-xs text-muted">{STATUS_LABELS[action.status] ?? "Suggestion"}</p>
          {action.failureReason ? (
            <p className="mt-1 text-sm text-danger">{action.failureReason}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasDetail ? (
            <button
              type="button"
              onClick={() => onViewDetail(action.id)}
              className="liquid-pill inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-sm font-semibold"
            >
              Details
            </button>
          ) : null}

          {isExecuted && action.result?.entityKind ? (
            <Link
              to={resultLink(action.result.entityKind, action.result.createdEntityId).to}
              className="liquid-pill inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold"
            >
              {resultLink(action.result.entityKind, action.result.createdEntityId).label}
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="liquid-panel rounded-2xl p-4 md:rounded-lg">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        {preview.subtitle ?? "Suggestion"}
      </p>
      <p className="mt-1 text-base font-bold text-foreground">{preview.title}</p>

      {preview.lines.length > 0 ? (
        <dl className="mt-3 flex flex-col gap-1">
          {preview.lines.map((line, index) => (
            <div key={`${line.label}-${index}`} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="text-muted">{line.label}</dt>
              <dd className="text-right font-medium text-foreground">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {validationSummary.warnings.map((warning) => (
        <p key={warning} className="mt-3 flex items-start gap-2 text-sm text-secondary">
          <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{warning}</span>
        </p>
      ))}

      {validationSummary.duplicateCandidates.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-muted">You may already have:</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {validationSummary.duplicateCandidates.map((candidate) => (
              <li key={candidate.id} className="text-sm text-muted">
                {candidate.name}
                {candidate.reason ? ` — ${candidate.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mergeTarget ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-secondary">
          <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You're part-way through <strong className="font-semibold">{mergeTarget.title}</strong>.
            Add these to it, or save this as a separate workout.
          </span>
        </p>
      ) : null}

      {hasDetail ? (
        <button
          type="button"
          onClick={() => onViewDetail(action.id)}
          className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-secondary"
        >
          <LuListChecks className="h-4 w-4" />
          <span>View details</span>
        </button>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {mergeTarget ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onMergeIntoActiveWorkout(action.id)}
            className="liquid-primary-btn inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-40"
          >
            <LuPlus className="h-4 w-4" />
            <span>Add to current session</span>
          </button>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onConfirm(action.id)}
            className={`${
              mergeTarget ? "liquid-pill" : "liquid-primary-btn"
            } inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-40`}
          >
            <LuCheck className="h-4 w-4" />
            <span>{mergeTarget ? "Save separately" : "Create"}</span>
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onReject(action.id)}
            className="liquid-pill inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-40"
          >
            <LuX className="h-4 w-4" />
            <span>Dismiss</span>
          </button>
        </div>
      </div>
    </section>
  );
}
