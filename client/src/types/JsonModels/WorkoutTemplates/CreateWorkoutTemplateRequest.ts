import type { JsonModels } from "../../backend";

export interface CreateWorkoutTemplateRequest
{
	name: string;
	description?: string;
	estimatedDurationMinutes?: number;
	isPublic: boolean;
	exercises: JsonModels.WorkoutTemplates.CreateWorkoutTemplateExerciseRequest[];
}
