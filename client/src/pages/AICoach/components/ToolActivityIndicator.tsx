// Users should see what the coach looked at, without any raw tool payloads.
const TOOL_LABELS: Record<string, string> = {
  get_training_profile: "Reading your training profile",
  get_recent_workouts: "Checking recent workouts",
  get_exercise_history: "Checking exercise history",
  search_exercises: "Searching exercises",
  get_workout_templates: "Looking at your templates",
  get_active_program: "Reading your program",
  get_program_calendar: "Reading your calendar",
  get_subscription_usage: "Checking your plan",
};

type ToolActivityIndicatorProps = {
  tools: string[];
  isSending: boolean;
};

export function ToolActivityIndicator({ tools, isSending }: ToolActivityIndicatorProps) {
  if (!isSending && tools.length === 0) {
    return null;
  }

  return (
    <div className="px-1 py-2 text-xs text-muted">
      {isSending ? <p>Thinking...</p> : null}
      {tools.map((tool) => (
        <p key={tool}>{TOOL_LABELS[tool] ?? tool}</p>
      ))}
    </div>
  );
}
