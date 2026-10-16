import type { JsonModels } from "../../backend";

export interface ExerciseRecordsModel
{
	heaviestWeight?: JsonModels.Analytics.ExerciseRecordModel;
	bestEstimatedOneRepMax?: JsonModels.Analytics.ExerciseRecordModel;
	mostReps?: JsonModels.Analytics.ExerciseRecordModel;
	bestSessionVolume?: JsonModels.Analytics.ExerciseRecordModel;
}
