import type { JsonModels } from "../../backend";
import type { AIRunStatus } from "../Enums/AIRunStatus";

export interface AIRunSnapshotModel
{
	id: number;
	conversationId: number;
	status: AIRunStatus;
	currentProgressCode: string;
	lastEventId: number;
	events: JsonModels.AI.AIProgressEventModel[];
	assistantMessage?: JsonModels.AI.AIMessageModel;
	actions: JsonModels.AIActions.AIActionModel[];
	usage?: JsonModels.AI.AIUsageSummaryModel;
	publicErrorCode?: string;
}
