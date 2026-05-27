import type { JsonModels } from "../../backend";
import type { ExerciseGroupType } from "../Enums/ExerciseGroupType";

export interface WorkoutExerciseGroupModel
{
	id: number;
	sortOrder: number;
	groupType: ExerciseGroupType;
	exercises: JsonModels.Workouts.WorkoutExerciseModel[];
}
