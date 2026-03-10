export interface CreateExerciseRequest
{
	name: string;
	slug: string;
	description?: string;
	imageUrl?: string;
	videoUrl?: string;
	primaryMuscleGroupId: number;
	secondaryMuscleGroupId?: number;
}
