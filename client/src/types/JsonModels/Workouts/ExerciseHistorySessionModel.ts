import type { JsonModels } from "../../backend";

export interface ExerciseHistorySessionModel
{
	workoutId: number;
	workoutTitle: string;
	workoutStartedAt: string;
	sets: JsonModels.Workouts.PreviousExerciseSetModel[];
}
