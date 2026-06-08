export interface PersonalRecordSummaryModel
{
	exerciseId: number;
	exerciseName: string;
	primaryMuscleGroupId: number;
	primaryMuscleGroupName: string;
	bestWeightKg?: number;
	bestReps?: number;
	bestEstimatedOneRepMax?: number;
	bestVolumeKg?: number;
	lastTrainedOn: string;
}
