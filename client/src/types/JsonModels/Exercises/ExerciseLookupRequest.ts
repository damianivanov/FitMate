export interface ExerciseLookupRequest
{
	search?: string;
	muscleGroupIds?: number[];
	skip: number;
	take: number;
}
