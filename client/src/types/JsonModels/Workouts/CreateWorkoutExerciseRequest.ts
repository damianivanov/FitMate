import type { JsonModels } from "../../backend";

export interface CreateWorkoutExerciseRequest
{
	exerciseId: number;
	notes?: string;
	sets: JsonModels.Workouts.CreateWorkoutSetRequest[];
}
