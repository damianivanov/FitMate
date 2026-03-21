import type { ExerciseSetType } from "../Enums/ExerciseSetType";

export interface PreviousExerciseSetModel
{
	setNumber: number;
	setType: ExerciseSetType;
	weightKg?: number;
	reps?: number;
	durationSeconds?: number;
	distanceMeters?: number;
	rpe?: number;
	notes?: string;
}
