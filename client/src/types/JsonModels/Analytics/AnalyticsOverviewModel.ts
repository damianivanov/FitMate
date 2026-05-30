import type { JsonModels } from "../../backend";

export interface AnalyticsOverviewModel
{
	workoutCount: number;
	totalVolumeKg: number;
	totalSets: number;
	totalReps: number;
	volumeTrend: JsonModels.Analytics.VolumeTrendPointModel[];
	muscleGroupVolumes: JsonModels.Analytics.MuscleGroupVolumeModel[];
	personalRecords: JsonModels.Analytics.PersonalRecordSummaryModel[];
}
