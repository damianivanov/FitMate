import type { JsonModels } from "../../backend";

export interface ProposedExercise
{
	exerciseId: number;
	newExerciseClientKey?: string;
	sets: JsonModels.AIActions.ProposedSet[];
}
