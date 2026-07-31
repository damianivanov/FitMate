import type { JsonModels } from "../../backend";

export interface AICostSummaryModel
{
	from: string;
	to: string;
	estimatedCost: number;
	inputTokens: number;
	outputTokens: number;
	cachedInputTokens: number;
	byDay: JsonModels.AdminAI.AICostByDayModel[];
	byModel: JsonModels.AdminAI.AICostByModelModel[];
	byPlan: JsonModels.AdminAI.AICostByPlanModel[];
}
