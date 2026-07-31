import type { JsonModels } from "../../backend";
import type { AIRunStatus } from "../Enums/AIRunStatus";

export interface AIAdminRunModel
{
	id: number;
	userId: number;
	userEmail?: string;
	conversationId: number;
	status: AIRunStatus;
	provider: string;
	model: string;
	promptVersion: string;
	inputTokens: number;
	outputTokens: number;
	cachedInputTokens: number;
	estimatedCost?: number;
	toolCallCount: number;
	durationMilliseconds: number;
	errorCode?: string;
	errorMessage?: string;
	startedAt: string;
	completedAt?: string;
	toolExecutions: JsonModels.AdminAI.AIAdminToolExecutionModel[];
}
