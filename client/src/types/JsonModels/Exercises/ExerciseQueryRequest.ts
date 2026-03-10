import type { JsonModels } from "../../backend";

export interface ExerciseQueryRequest extends JsonModels.Common.PagedRequest
{
	search?: string;
	isGlobal?: boolean;
	userId?: number;
}
