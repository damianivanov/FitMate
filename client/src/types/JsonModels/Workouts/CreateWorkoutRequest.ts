import type { JsonModels } from "../../backend";

export interface CreateWorkoutRequest
{
	title: string;
	startedAt?: string;
	finishedAt?: string;
	notes?: string;
	exercises: JsonModels.Workouts.CreateWorkoutExerciseRequest[];
}
