export interface AIUserModelCostModel
{
	model: string;
	runCount: number;
	inputTokens: number;
	cachedInputTokens: number;
	outputTokens: number;
	estimatedCost: number;
}
