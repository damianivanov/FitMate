import type { JsonModels } from "../../backend";
import type { AIRunStatus } from "../Enums/AIRunStatus";

export interface AIRunQueryRequest extends JsonModels.Common.PagedRequest
{
	userId?: number;
	conversationId?: number;
	status?: AIRunStatus;
	model?: string;
	from?: string;
	to?: string;
	failuresOnly: boolean;
}
