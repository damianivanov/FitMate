import type { JsonModels } from "../../backend";

export interface ExerciseProgressionModel
{
	exerciseId: number;
	exerciseName: string;
	points: JsonModels.Analytics.ExerciseProgressionPointModel[];
	summary: JsonModels.Analytics.ExerciseProgressionSummaryModel;
	records: JsonModels.Analytics.ExerciseRecordsModel;
	sessions: JsonModels.Analytics.ExerciseSessionModel[];
}
