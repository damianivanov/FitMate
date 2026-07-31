import type { JsonModels } from "../../backend";

export interface ProposeProgramUpdatePayload
{
	programPlanId: number;
	reason: string;
	workoutsPerWeek: number;
	schedule: JsonModels.AIActions.ProposedProgramScheduleItem[];
	newTemplates: JsonModels.AIActions.ProposedProgramTemplate[];
}
