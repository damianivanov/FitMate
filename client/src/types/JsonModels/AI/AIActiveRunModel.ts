import type { AIRunStatus } from "../Enums/AIRunStatus";

export interface AIActiveRunModel
{
	runId: number;
	status: AIRunStatus;
	currentProgressCode: string;
	lastEventId: number;
}
