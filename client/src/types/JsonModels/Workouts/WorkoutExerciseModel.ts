import type { JsonModels } from "../../backend";
import type { ExerciseLoadBasis } from "../Enums/ExerciseLoadBasis";

export interface WorkoutExerciseModel
{
	id: number;
	exerciseId: number;
	exerciseName: string;
	exerciseImageUrl?: string;
	exerciseLoadBasis?: ExerciseLoadBasis;
	orderIndex: number;
	notes?: string;
	sets: JsonModels.Workouts.WorkoutSetModel[];
}
