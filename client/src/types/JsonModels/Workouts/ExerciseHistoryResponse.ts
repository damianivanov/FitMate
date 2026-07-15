import type { JsonModels } from "../../backend";

export interface ExerciseHistoryResponse
{
	items: JsonModels.Workouts.ExerciseHistoryModel[];
}
