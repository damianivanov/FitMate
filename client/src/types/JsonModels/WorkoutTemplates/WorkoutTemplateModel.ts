import type { JsonModels } from "../../backend";

export interface WorkoutTemplateModel
{
	id: number;
	userId?: number;
	name: string;
	description?: string;
	estimatedDurationMinutes?: number;
	isPublic: boolean;
	exerciseCount: number;
	setCount: number;
	dateCreated: string;
	groups: JsonModels.WorkoutTemplates.WorkoutTemplateExerciseGroupModel[];
}
