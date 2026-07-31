import type { JsonModels } from "../../backend";

export interface ProposedProgramTemplate
{
	clientKey: string;
	name: string;
	description?: string;
	estimatedDurationMinutes?: number;
	exercises: JsonModels.AIActions.ProposedExercise[];
}
