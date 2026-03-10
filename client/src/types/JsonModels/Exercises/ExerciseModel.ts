export interface ExerciseModel
{
	id: number;
	userId?: number;
	name: string;
	slug: string;
	description?: string;
	imageUrl?: string;
	videoUrl?: string;
	primaryMuscleGroupId: number;
	secondaryMuscleGroupId?: number;
	dateCreated: string;
	dateModified?: string;
}
