export interface FrequentExerciseSummaryModel
{
	exerciseId: number;
	exerciseName: string;
	primaryMuscleGroupId: number;
	primaryMuscleGroupName: string;
	workoutCount: number;
	setCount: number;
	lastTrainedOn: string;
}
