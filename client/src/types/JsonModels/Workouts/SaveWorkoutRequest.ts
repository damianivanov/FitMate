import type { JsonModels } from "../../backend";

export interface SaveWorkoutRequest
{
	workoutId?: number;
	workoutTemplateId?: number;
	title: string;
	startedAt?: string;
	finishedAt?: string;
	notes?: string;
	exercises: JsonModels.Workouts.CreateWorkoutExerciseRequest[];
}
