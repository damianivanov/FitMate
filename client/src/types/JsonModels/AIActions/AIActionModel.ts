import type { JsonModels } from "../../backend";
import type { AIActionStatus } from "../Enums/AIActionStatus";
import type { AIActionType } from "../Enums/AIActionType";

export interface AIActionModel
{
	id: number;
	conversationId: number;
	aiRunId: number;
	actionType: AIActionType;
	status: AIActionStatus;
	preview: JsonModels.AIActions.AIActionPreviewModel;
	validationSummary: JsonModels.AIActions.AIActionValidationSummaryModel;
	result?: JsonModels.AIActions.AIActionResultModel;
	expiresAt?: string;
	executedAt?: string;
	failureReason?: string;
	dateCreated: string;
}
