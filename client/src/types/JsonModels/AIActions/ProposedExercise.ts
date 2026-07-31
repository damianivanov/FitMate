import type { JsonModels } from "../../backend";

export interface ProposedExercise
{
	exerciseId: number;
	sets: JsonModels.AIActions.ProposedSet[];
}
