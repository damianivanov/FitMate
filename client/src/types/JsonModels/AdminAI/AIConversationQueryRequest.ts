import type { JsonModels } from "../../backend";
import type { AIConversationStatus } from "../Enums/AIConversationStatus";

export interface AIConversationQueryRequest extends JsonModels.Common.PagedRequest
{
	search?: string;
	userId?: number;
	status?: AIConversationStatus;
	from?: string;
	to?: string;
}
