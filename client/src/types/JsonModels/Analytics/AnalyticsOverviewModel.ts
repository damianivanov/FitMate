import type { JsonModels } from "../../backend";

export interface AnalyticsOverviewModel
{
	workoutCount: number;
	totalVolumeKg: number;
	totalSets: number;
	totalReps: number;
	volumeTrend: JsonModels.Analytics.VolumeTrendPointModel[];
	frequentExercises: JsonModels.Analytics.FrequentExerciseSummaryModel[];
	muscleGroupVolumes: JsonModels.Analytics.MuscleGroupVolumeModel[];
	personalRecords: JsonModels.Analytics.PersonalRecordSummaryModel[];
}
