import { Link } from "react-router";
import { LuCheck, LuTriangleAlert, LuX } from "react-icons/lu";
import { AIActionStatus, type AIActionModel } from "@/types";

const STATUS_LABELS: Record<number, string> = {
  [AIActionStatus.PendingConfirmation]: "Needs your confirmation",
  [AIActionStatus.Confirmed]: "Confirmed",
  [AIActionStatus.Executing]: "Applying...",
  [AIActionStatus.Executed]: "Created",
  [AIActionStatus.Rejected]: "Dismissed",
  [AIActionStatus.Expired]: "Expired",
  [AIActionStatus.Failed]: "Could not be applied",
};

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
  onConfirm: (actionId: number) => Promise<void>;
  onReject: (actionId: number) => Promise<void>;
};

export function ActionCard({ action, isBusy, onConfirm, onReject }: ActionCardProps) {
  const isPending = action.status === AIActionStatus.PendingConfirmation;
  const isExecuted = action.status === AIActionStatus.Executed;
  const { preview, validationSummary } = action;

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

      {isPending ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onConfirm(action.id)}
            className="liquid-primary-btn inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-40"
          >
            <LuCheck className="h-4 w-4" />
            <span>Create</span>
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
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted">
            {STATUS_LABELS[action.status] ?? "Suggestion"}
          </p>

          {isExecuted && action.result?.entityKind ? (
            <Link
              to={resultLink(action.result.entityKind, action.result.createdEntityId).to}
              className="liquid-pill inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold"
            >
              {resultLink(action.result.entityKind, action.result.createdEntityId).label}
            </Link>
          ) : null}
        </div>
      )}

      {action.failureReason ? (
        <p className="mt-2 text-sm text-danger">{action.failureReason}</p>
      ) : null}
    </section>
  );
}
