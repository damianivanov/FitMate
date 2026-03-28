import type { JsonModels } from "../../backend";
import type { ExerciseGroupType } from "../Enums/ExerciseGroupType";

export interface WorkoutTemplateExerciseGroupModel
{
	id: number;
	sortOrder: number;
	groupType: ExerciseGroupType;
	restBetweenExercisesSeconds?: number;
	restAfterGroupSeconds?: number;
	rounds: number;
	exercises: JsonModels.WorkoutTemplates.WorkoutTemplateExerciseModel[];
}
