import type { JsonModels } from "../../backend";
import type { ExerciseGroupType } from "../Enums/ExerciseGroupType";

export interface CreateWorkoutExerciseRequest
{
	groupType: ExerciseGroupType;
	clientGroupId?: number;
	orderIndex: number;
	exerciseId: number;
	notes?: string;
	sets: JsonModels.Workouts.CreateWorkoutSetRequest[];
}
