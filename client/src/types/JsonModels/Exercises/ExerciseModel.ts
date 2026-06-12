export interface ExerciseModel
{
	id: number;
	userId?: number;
	isPublic: boolean;
	name: string;
	slug: string;
	description?: string;
	imageUrl?: string;
	videoUrl?: string;
	primaryMuscleGroupId: number;
	secondaryMuscleGroupId?: number;
	creatorDisplayName?: string;
	dateCreated: string;
	dateModified?: string;
}
