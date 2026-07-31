import type { JsonModels } from "../../backend";

export interface ProposeWorkoutPayload
{
	title: string;
	notes?: string;
	exercises: JsonModels.AIActions.ProposedExercise[];
}
