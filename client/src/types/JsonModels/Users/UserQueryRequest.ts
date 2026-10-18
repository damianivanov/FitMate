import type { JsonModels } from "../../backend";

export interface UserQueryRequest extends JsonModels.Common.GridQueryRequest
{
	search?: string;
}
