import type { ExerciseCategory } from "../Enums/ExerciseCategory";
import type { ExerciseDifficulty } from "../Enums/ExerciseDifficulty";
import type { ExerciseEquipment } from "../Enums/ExerciseEquipment";
import type { ExerciseLoadBasis } from "../Enums/ExerciseLoadBasis";
import type { ExerciseMovementPattern } from "../Enums/ExerciseMovementPattern";

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
	equipment?: ExerciseEquipment;
	movementPattern?: ExerciseMovementPattern;
	difficulty?: ExerciseDifficulty;
	category?: ExerciseCategory;
	loadBasis?: ExerciseLoadBasis;
	aliases: string[];
	creatorDisplayName?: string;
	dateCreated: string;
	dateModified?: string;
}
