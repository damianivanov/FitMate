export interface ExerciseProgressionSummaryModel
{
	sessionCount: number;
	totalSets: number;
	totalReps: number;
	totalVolumeKg: number;
	firstTrainedOn?: string;
	lastTrainedOn?: string;
}
