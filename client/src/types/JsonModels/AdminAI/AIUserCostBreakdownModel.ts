import type { JsonModels } from "../../backend";

export interface AIUserCostBreakdownModel
{
	userId: number;
	email?: string;
	planCode: string;
	planName: string;
	runCount: number;
	inputTokens: number;
	cachedInputTokens: number;
	outputTokens: number;
	totalTokens: number;
	estimatedCost: number;
	byModel: JsonModels.AdminAI.AIUserModelCostModel[];
}
