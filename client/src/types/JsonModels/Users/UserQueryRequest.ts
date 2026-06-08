import type { JsonModels } from "../../backend";

export interface UserQueryRequest extends JsonModels.Common.PagedRequest
{
	search?: string;
}
