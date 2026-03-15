export interface WorkoutCreatedModel
{
	workoutId: number;
	title: string;
	startedAt: string;
	finishedAt?: string;
	exerciseCount: number;
	setCount: number;
	totalVolumeKg?: number;
}
