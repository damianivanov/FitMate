import type { ExerciseSetType } from "../Enums/ExerciseSetType";

export interface WorkoutSetModel
{
	id: number;
	orderIndex: number;
	setType: ExerciseSetType;
	weightKg?: number;
	reps?: number;
	durationSeconds?: number;
	distanceMeters?: number;
	rpe?: number;
	isCompleted: boolean;
	notes?: string;
}
