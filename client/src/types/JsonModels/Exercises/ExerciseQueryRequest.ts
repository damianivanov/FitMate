import type { JsonModels } from "../../backend";

export interface ExerciseQueryRequest extends JsonModels.Common.GridQueryRequest
{
	search?: string;
	isGlobal?: boolean;
	userId?: number;
}
