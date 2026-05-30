export interface PersonalRecordSummaryModel
{
	exerciseId: number;
	exerciseName: string;
	bestWeightKg?: number;
	bestReps?: number;
	bestEstimatedOneRepMax?: number;
	bestVolumeKg?: number;
	lastTrainedOn: string;
}
