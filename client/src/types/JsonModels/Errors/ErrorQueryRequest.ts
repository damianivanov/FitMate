import type { JsonModels } from "../../backend";

export interface ErrorQueryRequest extends JsonModels.Common.PagedRequest
{
	search?: string;
}
