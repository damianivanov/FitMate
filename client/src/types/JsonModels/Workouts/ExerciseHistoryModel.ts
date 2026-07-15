import type { JsonModels } from "../../backend";

export interface ExerciseHistoryModel
{
	exerciseId: number;
	exerciseName: string;
	sessions: JsonModels.Workouts.ExerciseHistorySessionModel[];
}
