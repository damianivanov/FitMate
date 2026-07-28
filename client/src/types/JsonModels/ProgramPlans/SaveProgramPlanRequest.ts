import type { JsonModels } from "../../backend";
import type { ProgramScheduleType } from "../Enums/ProgramScheduleType";
import type { TrainingGoal } from "../Enums/TrainingGoal";

export interface SaveProgramPlanRequest
{
	name: string;
	description?: string;
	goal: TrainingGoal;
	scheduleType: ProgramScheduleType;
	startDate: string;
	endDate?: string;
	targetWorkoutsPerWeek: number;
	scheduleRules: JsonModels.ProgramPlans.ProgramScheduleRuleRequest[];
	customDays: JsonModels.ProgramPlans.CustomProgramDayRequest[];
}
