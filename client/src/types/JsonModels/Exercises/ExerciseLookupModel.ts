export interface ExerciseLookupModel
{
	id: number;
	userId?: number;
	isGlobal: boolean;
	name: string;
	slug: string;
	description?: string;
	imageUrl?: string;
	videoUrl?: string;
	primaryMuscleGroupId: number;
	primaryMuscleGroupName: string;
	secondaryMuscleGroupId?: number;
	secondaryMuscleGroupName?: string;
	creatorUserId?: number;
	creatorDisplayName?: string;
	dateCreated: string;
}
