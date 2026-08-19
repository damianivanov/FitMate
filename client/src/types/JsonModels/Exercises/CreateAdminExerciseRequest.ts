import type { ExerciseCategory } from "../Enums/ExerciseCategory";
import type { ExerciseDifficulty } from "../Enums/ExerciseDifficulty";
import type { ExerciseEquipment } from "../Enums/ExerciseEquipment";
import type { ExerciseLoadBasis } from "../Enums/ExerciseLoadBasis";
import type { ExerciseMovementPattern } from "../Enums/ExerciseMovementPattern";

export interface CreateAdminExerciseRequest
{
	name: string;
	description?: string;
	videoUrl?: string;
	primaryMuscleGroupId: number;
	secondaryMuscleGroupId?: number;
	equipment?: ExerciseEquipment;
	movementPattern?: ExerciseMovementPattern;
	difficulty?: ExerciseDifficulty;
	category?: ExerciseCategory;
	loadBasis?: ExerciseLoadBasis;
	aliases?: string[];
	isPrivate: boolean;
}
