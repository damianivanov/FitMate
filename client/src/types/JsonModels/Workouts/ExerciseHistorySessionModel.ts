import type { JsonModels } from "../../backend";

export interface ExerciseHistorySessionModel
{
	workoutId: number;
	workoutTitle: string;
	workoutStartedAt: string;
	exercisePosition: number;
	sets: JsonModels.Workouts.PreviousExerciseSetModel[];
}
