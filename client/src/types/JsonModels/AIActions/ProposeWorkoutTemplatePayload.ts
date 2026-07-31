import type { JsonModels } from "../../backend";

export interface ProposeWorkoutTemplatePayload
{
	name: string;
	description?: string;
	estimatedDurationMinutes?: number;
	isPublic: boolean;
	exercises: JsonModels.AIActions.ProposedExercise[];
}
