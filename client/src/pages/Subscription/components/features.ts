import { SubscriptionFeature } from "@/types";

export const FEATURE_LABELS: Record<number, string> = {
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
  [SubscriptionFeature.AIContextTokens]: "AI context size (tokens)",
  [SubscriptionFeature.AIConversationMessages]: "AI conversation history",
};

/**
 * Tuning knobs for how the coach runs, not quotas anyone spends. They have no usage bucket, so a
 * "0 of N used" bar would be a meter that can never move.
 */
const INTERNAL_FEATURES: ReadonlySet<number> = new Set([
  SubscriptionFeature.AIContextTokens,
  SubscriptionFeature.AIConversationMessages,
]);

export function isCustomerFacingFeature(feature: number): boolean {
  return !INTERNAL_FEATURES.has(feature);
}
