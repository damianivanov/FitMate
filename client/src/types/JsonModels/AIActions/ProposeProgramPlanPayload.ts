import type { JsonModels } from "../../backend";
import type { ProgramScheduleType } from "../Enums/ProgramScheduleType";
import type { TrainingGoal } from "../Enums/TrainingGoal";

export interface ProposeProgramPlanPayload
{
	name: string;
	description?: string;
	goal: TrainingGoal;
	scheduleType: ProgramScheduleType;
	startDate: string;
	endDate?: string;
	workoutsPerWeek: number;
	schedule: JsonModels.AIActions.ProposedProgramScheduleItem[];
	newTemplates: JsonModels.AIActions.ProposedProgramTemplate[];
}
