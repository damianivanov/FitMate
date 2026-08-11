import type { AIProgressEventModel } from "@/types";
import { progressLabel } from "../progressLabels";

type ToolActivityIndicatorProps = {
  events: AIProgressEventModel[];
  isSending: boolean;
};

export function ToolActivityIndicator({ events, isSending }: ToolActivityIndicatorProps) {
  if (!isSending) {
    return null;
  }

  // Keyed on the event id, not the tool name: one run can call the same tool twice.
  const completed = events
    .filter((event) => event.code === "tool_completed")
    .map((event) => ({ id: event.id, label: progressLabel(event.code, event.toolName) }))
    .filter((entry): entry is { id: number; label: string } => entry.label != null);

  const latest = events.at(-1);
  const current = latest ? progressLabel(latest.code, latest.toolName) : null;

  return (
    <div className="px-1 py-2 text-xs text-muted">
      {completed.map((entry) => (
        <p key={entry.id} className="opacity-60">
          {entry.label}
        </p>
      ))}
      <p>{current ?? "Thinking"}</p>
    </div>
  );
}
