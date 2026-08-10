import type { JsonModels } from "../../backend";

export interface ProposedNewExercise extends JsonModels.AIActions.ProposeExercisePayload
{
	clientKey: string;
}
