import type { ExerciseCategory } from "../Enums/ExerciseCategory";
import type { ExerciseDifficulty } from "../Enums/ExerciseDifficulty";
import type { ExerciseEquipment } from "../Enums/ExerciseEquipment";
import type { ExerciseMovementPattern } from "../Enums/ExerciseMovementPattern";

export interface ProposeExercisePayload
{
	name: string;
	description?: string;
	primaryMuscleGroupId: number;
	secondaryMuscleGroupId?: number;
	equipment?: ExerciseEquipment;
	movementPattern?: ExerciseMovementPattern;
	difficulty?: ExerciseDifficulty;
	category?: ExerciseCategory;
	isPublic: boolean;
	aliases: string[];
	isGlobal: boolean;
}
