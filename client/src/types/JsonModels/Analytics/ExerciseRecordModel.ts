export interface ExerciseRecordModel
{
	workoutId: number;
	achievedOn: string;
	value: number;
	weightKg?: number;
	reps?: number;
}
