export interface WorkoutTemplateExerciseSetModel
{
	id: number;
	orderIndex: number;
	weightKg?: number;
	reps?: number;
	durationSeconds?: number;
	distanceMeters?: number;
	rpe?: number;
	restSeconds?: number;
	notes?: string;
}
