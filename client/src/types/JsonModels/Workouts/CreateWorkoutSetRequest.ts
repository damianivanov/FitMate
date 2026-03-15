import type { Enums } from "../../backend";

export interface CreateWorkoutSetRequest
{
	setType: Enums.ExerciseSetType;
	weightKg?: number;
	reps?: number;
	durationSeconds?: number;
	distanceMeters?: number;
	rpe?: number;
	notes?: string;
}
