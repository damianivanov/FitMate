import type { ExerciseCategory } from "../Enums/ExerciseCategory";
import type { ExerciseDifficulty } from "../Enums/ExerciseDifficulty";
import type { ExerciseEquipment } from "../Enums/ExerciseEquipment";
import type { ExerciseMovementPattern } from "../Enums/ExerciseMovementPattern";

export interface CreateExerciseRequest
{
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
	aliases?: string[];
	isPublic: boolean;
}
