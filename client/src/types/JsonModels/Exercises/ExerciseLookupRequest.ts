import type { JsonModels } from "../../backend";

export interface ExerciseLookupRequest extends JsonModels.Common.OffsetPagedRequest
{
	search?: string;
	muscleGroupIds?: number[];
}
