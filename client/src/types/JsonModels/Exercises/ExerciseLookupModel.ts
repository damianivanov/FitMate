import type { ExerciseCategory } from "../Enums/ExerciseCategory";
import type { ExerciseDifficulty } from "../Enums/ExerciseDifficulty";
import type { ExerciseEquipment } from "../Enums/ExerciseEquipment";
import type { ExerciseLoadBasis } from "../Enums/ExerciseLoadBasis";
import type { ExerciseMovementPattern } from "../Enums/ExerciseMovementPattern";

export interface ExerciseLookupModel
{
	id: number;
	userId?: number;
	isGlobal: boolean;
	isPublic: boolean;
	name: string;
	slug: string;
	description?: string;
	imageUrl?: string;
	videoUrl?: string;
	primaryMuscleGroupId: number;
	primaryMuscleGroupName: string;
	secondaryMuscleGroupId?: number;
	secondaryMuscleGroupName?: string;
	equipment?: ExerciseEquipment;
	movementPattern?: ExerciseMovementPattern;
	difficulty?: ExerciseDifficulty;
	category?: ExerciseCategory;
	loadBasis?: ExerciseLoadBasis;
	aliases: string[];
	creatorUserId?: number;
	creatorDisplayName?: string;
	dateCreated: string;
}
