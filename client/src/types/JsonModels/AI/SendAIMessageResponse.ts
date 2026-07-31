import type { JsonModels } from "../../backend";

export interface SendAIMessageResponse
{
	conversationId: number;
	message: JsonModels.AI.AIMessageModel;
	usedTools: string[];
	actions: JsonModels.AIActions.AIActionModel[];
	usage: JsonModels.AI.AIUsageSummaryModel;
}
