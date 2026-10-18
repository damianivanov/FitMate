import type { JsonModels } from "../../backend";
import type { AIConversationStatus } from "../Enums/AIConversationStatus";

export interface AIConversationQueryRequest extends JsonModels.Common.GridQueryRequest
{
	search?: string;
	userId?: number;
	status?: AIConversationStatus;
	from?: string;
	to?: string;
}
