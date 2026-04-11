import type { JsonModels } from "../../backend";
import type { ExerciseGroupType } from "../Enums/ExerciseGroupType";

export interface CreateWorkoutTemplateExerciseRequest
{
	groupType: ExerciseGroupType;
	exerciseId: number;
	notes?: string;
	sets: JsonModels.WorkoutTemplates.CreateWorkoutTemplateExerciseSetRequest[];
}
