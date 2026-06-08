export interface WorkoutCalendarDayModel
{
	workoutId: number;
	title: string;
	date: string;
	durationSeconds?: number;
	totalVolumeKg?: number;
	exerciseCount: number;
	setCount: number;
}
