import type { JsonModels } from "../../backend";

export interface WorkoutExerciseModel
{
	id: number;
	exerciseId: number;
	exerciseName: string;
	exerciseImageUrl?: string;
	orderIndex: number;
	notes?: string;
	sets: JsonModels.Workouts.WorkoutSetModel[];
}
