import type { JsonModels } from "../../backend";

export interface AIAdminOverviewModel
{
	days: number;
	from: string;
	to: string;
	totalRuns: number;
	failedRuns: number;
	activeUsers: number;
	conversations: number;
	messages: number;
	toolCalls: number;
	failedToolCalls: number;
	proposedActions: number;
	confirmedActions: number;
	inputTokens: number;
	outputTokens: number;
	estimatedCost: number;
	averageDurationMilliseconds: number;
	p95DurationMilliseconds: number;
	topTools: JsonModels.AdminAI.AIToolUsageModel[];
	topUsersByCost: JsonModels.AdminAI.AIUserCostModel[];
	costByDay: JsonModels.AdminAI.AICostByDayModel[];
	topUnsupportedCategories: JsonModels.AdminAI.UnsupportedCategoryCountModel[];
}
