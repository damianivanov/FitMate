import type { ExerciseSetType } from "../Enums/ExerciseSetType";

export interface CreateWorkoutTemplateExerciseSetRequest
{
	setType: ExerciseSetType;
	weightKg?: number;
	reps?: number;
	durationSeconds?: number;
	distanceMeters?: number;
	rpe?: number;
	restSeconds?: number;
	notes?: string;
}
