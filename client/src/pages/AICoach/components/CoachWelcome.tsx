import type { IconType } from "react-icons";
import {
  LuChartLine,
  LuCircleHelp,
  LuClipboardList,
  LuDumbbell,
  LuSparkles,
} from "react-icons/lu";
import { useUserStore } from "@/stores/userStore";

type Suggestion = {
  label: string;
  prompt: string;
  icon: IconType;
};

// Short labels, full questions. The label teaches what the coach is for; the prompt it sends
// demonstrates the level of detail that gets a good answer.
const SUGGESTIONS: Suggestion[] = [
  {
    label: "Train today",
    prompt: "What should I train today, based on my recent workouts?",
    icon: LuDumbbell,
  },
  {
    label: "Check progress",
    prompt: "How has my bench press progressed over the last two months?",
    icon: LuChartLine,
  },
  {
    label: "Plan a block",
    prompt: "Build me a 4-week program for strength, training 3 days a week.",
    icon: LuClipboardList,
  },
  {
    label: "Break a plateau",
    prompt: "My squat has been stuck at the same weight for 3 weeks. What should I change?",
    icon: LuCircleHelp,
  },
];

function getGreeting(hour: number): string {
  if (hour < 5) {
    return "Still up";
  }

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

type CoachSuggestionsProps = {
  onPick: (prompt: string) => void;
  isSending: boolean;
};

export function CoachWelcome() {
  const user = useUserStore((state) => state.user);
  const greeting = getGreeting(new Date().getHours());
  const firstName = user?.firstName?.trim();

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        <LuSparkles className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        {firstName ? `${greeting}, ${firstName}` : greeting}
      </h1>
      <p className="mt-2 max-w-md text-sm text-secondary">
        I can see your workouts, programs and progress. Ask me anything about your training.
      </p>
    </div>
  );
}

export function CoachSuggestions({ onPick, isSending }: CoachSuggestionsProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <ul className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => {
          const Icon = suggestion.icon;

          return (
            <li key={suggestion.label}>
              <button
                type="button"
                disabled={isSending}
                onClick={() => onPick(suggestion.prompt)}
                title={suggestion.prompt}
                className="liquid-pill liquid-press inline-flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {suggestion.label}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="max-w-sm text-center text-xs text-tertiary">
        The more you give me, the better I answer — name the lift, the weight, and how it felt.
      </p>
    </div>
  );
}
