import type { AIToolExecutionStatus } from "../Enums/AIToolExecutionStatus";

export interface AIAdminToolExecutionModel
{
	id: number;
	toolName: string;
	status: AIToolExecutionStatus;
	durationMilliseconds: number;
	errorCode?: string;
	errorMessage?: string;
	startedAt: string;
}
