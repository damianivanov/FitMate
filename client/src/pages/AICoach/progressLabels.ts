// What the coach is doing, in the user's terms. Codes come from the server; the wording lives here.
const PROGRESS_LABELS: Record<string, string> = {
  run_queued: "Preparing your request",
  run_started: "Thinking",
  provider_thinking: "Planning the next step",
  response_composing: "Writing the answer",
};

const TOOL_LABELS: Record<string, string> = {
  get_workout_creation_context: "Reviewing your workout context",
  get_training_profile: "Reviewing your training profile",
  get_recent_workouts: "Checking recent workouts",
  get_exercise_history: "Reviewing recent performance",
  search_exercises: "Finding suitable exercises",
  get_workout_templates: "Checking your workout templates",
  get_active_program: "Checking your active program",
  get_program_calendar: "Checking your training calendar",
  get_subscription_usage: "Checking your plan",
  propose_workout: "Preparing your workout suggestion",
  propose_workout_template: "Preparing your template suggestion",
  propose_program_plan: "Preparing your program suggestion",
  propose_program_update: "Preparing your program update",
  propose_exercise: "Preparing a new exercise",
  report_unsupported_request: "Noting your request",
};

export const TERMINAL_PROGRESS_CODES = new Set([
  "run_completed",
  "run_failed",
  "run_limited",
  "run_cancelled",
]);

/// An unmapped tool falls back to generic copy rather than leaking its internal name.
export function progressLabel(code: string, toolName?: string | null): string | null {
  if (toolName) {
    return TOOL_LABELS[toolName] ?? "Working on your request";
  }

  return PROGRESS_LABELS[code] ?? null;
}
