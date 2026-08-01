import type { JsonModels } from "../../backend";

export interface AIUserCostQueryRequest extends JsonModels.Common.PagedRequest
{
	days: number;
	search?: string;
}
