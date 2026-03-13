import type { JsonModels } from "../../backend";

export interface MuscleGroupQueryRequest extends JsonModels.Common.PagedRequest
{
	search?: string;
}
