import type { JsonModels } from "../../backend";
import type { AIRunStatus } from "../Enums/AIRunStatus";

export interface StartAIRunResponse
{
	conversationId: number;
	runId: number;
	status: AIRunStatus;
	userMessage: JsonModels.AI.AIMessageModel;
}
