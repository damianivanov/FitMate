import type { JsonModels } from "../../backend";

export interface PreviousExerciseSetsModel
{
	exerciseId: number;
	exerciseName: string;
	workoutId: number;
	workoutTitle: string;
	workoutStartedAt: string;
	sets: JsonModels.Workouts.PreviousExerciseSetModel[];
}
