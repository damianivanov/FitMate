import type { AIActionStatus } from "../Enums/AIActionStatus";
import type { AIActionType } from "../Enums/AIActionType";

export interface AIAdminActionModel
{
	id: number;
	actionType: AIActionType;
	status: AIActionStatus;
	dateCreated: string;
	executedAt?: string;
	failureReason?: string;
}
