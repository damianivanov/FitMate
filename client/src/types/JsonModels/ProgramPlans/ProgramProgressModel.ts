export interface ProgramProgressModel
{
	scheduledWorkouts: number;
	completedWorkouts: number;
	startedWorkouts: number;
	missedWorkouts: number;
	skippedWorkouts: number;
	remainingWorkouts: number;
	completionPercentage?: number;
	adherencePercentage: number;
	currentStreak: number;
}
