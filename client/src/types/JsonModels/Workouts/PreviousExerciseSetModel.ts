import type { Enums } from "../../backend";

export interface PreviousExerciseSetModel
{
	setNumber: number;
	setType: Enums.ExerciseSetType;
	weightKg?: number;
	reps?: number;
	durationSeconds?: number;
	distanceMeters?: number;
	rpe?: number;
	notes?: string;
}
