import type { IconType } from "react-icons";
import {
  LuChartLine,
  LuCircleHelp,
  LuClipboardList,
  LuDumbbell,
  LuSparkles,
} from "react-icons/lu";
import { NativeCard } from "@/shared/components";
import { useUserStore } from "@/stores/userStore";

type Suggestion = {
  label: string;
  hint: string;
  prompt: string;
  icon: IconType;
};

// Short labels, full questions. The label teaches what the coach is for; the prompt it sends
// demonstrates the level of detail that gets a good answer.
const SUGGESTIONS: Suggestion[] = [
  {
    label: "Train today",
    hint: "Pick a session from recent work",
    prompt: "What should I train today, based on my recent workouts?",
    icon: LuDumbbell,
  },
  {
    label: "Check progress",
    hint: "Find trends and plateaus",
    prompt: "How has my bench press progressed over the last two months?",
    icon: LuChartLine,
  },
  {
    label: "Plan a block",
    hint: "Build a program from your profile",
    prompt: "Build me a 4-week program for strength, training 3 days a week.",
    icon: LuClipboardList,
  },
  {
    label: "Break a plateau",
    hint: "Change what stopped working",
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
    <NativeCard className="cch-welcome">
      <span className="cch-orb" aria-hidden="true">
        <LuSparkles className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <b>{firstName ? `${greeting}, ${firstName}` : greeting}</b>
        <p>
          I can see your workouts, programs and progress. Ask me anything about your training.
        </p>
      </div>
    </NativeCard>
  );
}

export function CoachSuggestions({ onPick, isSending }: CoachSuggestionsProps) {
  return (
    <div className="cch-suggestions">
      {SUGGESTIONS.map((suggestion) => {
        const Icon = suggestion.icon;

        return (
          <button
            type="button"
            key={suggestion.label}
            disabled={isSending}
            onClick={() => onPick(suggestion.prompt)}
            title={suggestion.prompt}
            className="native-tile"
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <b>{suggestion.label}</b>
            <small>{suggestion.hint}</small>
          </button>
        );
      })}
    </div>
  );
}
