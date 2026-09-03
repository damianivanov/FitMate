import type { JsonModels } from "../../backend";
import type { AIActionStatus } from "../Enums/AIActionStatus";
import type { AIActionType } from "../Enums/AIActionType";

export interface AIActionDetailModel
{
	actionId: number;
	actionType: AIActionType;
	status: AIActionStatus;
	title: string;
	notes?: string;
	estimatedDurationMinutes: number;
	exercises: JsonModels.AIActions.AIProposalExerciseModel[];
}
