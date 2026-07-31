import { SubscriptionFeature, type FeatureAvailabilityModel } from "@/types";

const FEATURE_LABELS: Record<number, string> = {
  [SubscriptionFeature.AIChat]: "AI chat messages",
  [SubscriptionFeature.AIWorkoutGeneration]: "AI workout generation",
  [SubscriptionFeature.AIProgramGeneration]: "AI program generation",
  [SubscriptionFeature.AIExerciseRecognition]: "Exercise recognition",
  [SubscriptionFeature.AIImageGeneration]: "AI image generation",
  [SubscriptionFeature.AITrainingAnalysis]: "AI training analysis",
  [SubscriptionFeature.ActiveProgramPlans]: "Active program plans",
  [SubscriptionFeature.ProgramPlanDurationMonths]: "Program length (months)",
  [SubscriptionFeature.CustomWorkoutTemplates]: "Custom workout templates",
  [SubscriptionFeature.ExerciseHistoryMonths]: "Exercise history (months)",
};

type UsageBarProps = {
  availability: FeatureAvailabilityModel;
};

export function UsageBar({ availability }: UsageBarProps) {
  const label = FEATURE_LABELS[availability.feature] ?? `Feature ${availability.feature}`;

  if (!availability.isEnabled) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-xs font-semibold text-muted">Not included</span>
      </div>
    );
  }

  // A null limit means the plan grants this without a ceiling.
  if (availability.limit == null) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">{label}</span>
        <span className="text-xs font-semibold text-primary">Unlimited</span>
      </div>
    );
  }

  const consumed = availability.used + availability.reserved;
  const percentage =
    availability.limit === 0 ? 100 : Math.min(100, (consumed / availability.limit) * 100);
  const isExhausted = percentage >= 100;

  return (
    <div className="py-2">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted">
          {consumed} of {availability.limit} used
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-(--glass-bg-soft)"
        role="progressbar"
        aria-label={label}
        aria-valuenow={consumed}
        aria-valuemin={0}
        aria-valuemax={availability.limit}
      >
        <div
          className={
            isExhausted
              ? "h-full rounded-full bg-danger transition-[width] duration-300 ease-out motion-reduce:transition-none"
              : "h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
          }
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
