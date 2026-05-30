import type { JsonModels } from "../../backend";

export interface ExerciseProgressionModel
{
	exerciseId: number;
	exerciseName: string;
	points: JsonModels.Analytics.ExerciseProgressionPointModel[];
}
