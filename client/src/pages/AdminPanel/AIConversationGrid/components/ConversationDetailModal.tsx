import { LuTriangleAlert } from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import { Modal } from "@/shared/components";
import {
  AIActionStatus,
  AIActionType,
  AIMessageRole,
  AIRunStatus,
  type AIConversationDetailModel,
} from "@/types";

const ACTION_TYPE_LABELS: Record<number, string> = {
  [AIActionType.CreatePersonalExercise]: "New personal exercise",
  [AIActionType.CreateGlobalExercise]: "New global exercise",
  [AIActionType.CreateWorkout]: "New workout",
  [AIActionType.CreateWorkoutTemplate]: "New template",
  [AIActionType.CreateProgramPlan]: "New program",
  [AIActionType.UpdateProgramPlan]: "Program change",
  [AIActionType.GenerateExerciseImage]: "Exercise image",
};

const ACTION_STATUS_LABELS: Record<number, string> = {
  [AIActionStatus.PendingConfirmation]: "Pending",
  [AIActionStatus.Confirmed]: "Confirmed",
  [AIActionStatus.Executing]: "Executing",
  [AIActionStatus.Executed]: "Executed",
  [AIActionStatus.Rejected]: "Rejected",
  [AIActionStatus.Expired]: "Expired",
  [AIActionStatus.Failed]: "Failed",
};

const ROLE_LABELS: Record<number, string> = {
  [AIMessageRole.User]: "User",
  [AIMessageRole.Assistant]: "Assistant",
  [AIMessageRole.ToolCall]: "Tool call",
  [AIMessageRole.ToolResult]: "Tool result",
  [AIMessageRole.System]: "System",
};

const RUN_STATUS_LABELS: Record<number, string> = {
  [AIRunStatus.Running]: "Running",
  [AIRunStatus.Completed]: "Completed",
  [AIRunStatus.Failed]: "Failed",
  [AIRunStatus.Cancelled]: "Cancelled",
  [AIRunStatus.LimitExceeded]: "Limit exceeded",
};

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function isPayloadRole(role: number): boolean {
  return role === AIMessageRole.ToolCall || role === AIMessageRole.ToolResult;
}

function formatTime(value: string): string {
  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? "—" : TIME_FORMATTER.format(date);
}

type ConversationDetailModalProps = {
  conversation: AIConversationDetailModel | null;
  isLoading: boolean;
  onClose: () => void;
};

export function ConversationDetailModal({
  conversation,
  isLoading,
  onClose,
}: ConversationDetailModalProps) {
  return (
    <Modal
      isOpen={isLoading || conversation != null}
      onClose={onClose}
      title={conversation?.title ?? "Conversation"}
      maxWidth="3xl"
    >
      <div className="px-5 py-4">
        {isLoading || !conversation ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : (
          <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {conversation.userEmail ?? `User ${conversation.userId}`} · {formatTime(conversation.dateCreated)}
          </p>

          {!conversation.contentVisible ? (
            <p className="flex items-start gap-2 rounded-xl bg-white/5 p-3 text-sm text-secondary">
              <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This user turned off admin content review. Message bodies are hidden; the audit trail
                below is still complete.
              </span>
            </p>
          ) : null}

          <section>
            <h3 className="mb-2 text-sm font-bold text-foreground">Messages</h3>
            <ul className="flex flex-col gap-2">
              {conversation.messages.map((message) => (
                <li key={message.id} className="min-w-0 rounded-xl bg-white/5 p-3">
                  <p className="text-2xs font-semibold uppercase tracking-widest text-muted">
                    {ROLE_LABELS[message.role] ?? "Message"}
                    {message.toolName ? ` · ${message.toolName}` : ""} · {formatTime(message.dateCreated)}
                  </p>
                  <p
                    className={[
                      "mt-1 whitespace-pre-wrap break-words text-foreground",
                      isPayloadRole(message.role) ? "font-mono text-xs leading-relaxed" : "text-sm",
                    ].join(" ")}
                  >
                    {message.content}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold text-foreground">Runs</h3>
            {conversation.runs.length === 0 ? (
              <p className="text-sm text-muted">No runs recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {conversation.runs.map((run) => (
                  <li key={run.id} className="rounded-xl bg-white/5 p-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {run.model} · {RUN_STATUS_LABELS[run.status] ?? "Run"}
                      </span>
                      <span className="text-muted">
                        {`${run.inputTokens}/${run.outputTokens} tokens · ${run.durationMilliseconds}ms`}
                        {run.estimatedCost != null ? ` · $${run.estimatedCost.toFixed(4)}` : ""}
                      </span>
                    </div>

                    {run.errorMessage ? (
                      <p className="mt-1 break-words text-sm text-danger">{run.errorMessage}</p>
                    ) : null}

                    {run.toolExecutions.length > 0 ? (
                      <p className="mt-1 text-xs text-muted">
                        {run.toolExecutions
                          .map((execution) => `${execution.toolName} (${execution.durationMilliseconds}ms)`)
                          .join(", ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {conversation.actions.length > 0 ? (
            <section>
              <h3 className="mb-2 text-sm font-bold text-foreground">Proposed actions</h3>
              <ul className="flex flex-col gap-1">
                {conversation.actions.map((action) => (
                  <li key={action.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="shrink-0 text-foreground">
                      {ACTION_TYPE_LABELS[action.actionType] ?? "Action"}
                    </span>
                    <span className="min-w-0 break-words text-right text-muted">
                      {ACTION_STATUS_LABELS[action.status] ?? "—"}
                      {action.failureReason ? ` · ${action.failureReason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
