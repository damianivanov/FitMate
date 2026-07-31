import type { JsonModels } from "../../backend";
import type { ProgramPlanStatus } from "../Enums/ProgramPlanStatus";
import type { ProgramScheduleType } from "../Enums/ProgramScheduleType";
import type { TrainingGoal } from "../Enums/TrainingGoal";

export interface ProgramPlanModel
{
	id: number;
	name: string;
	description?: string;
	goal: TrainingGoal;
	status: ProgramPlanStatus;
	scheduleType: ProgramScheduleType;
	startDate: string;
	endDate?: string;
	targetWorkoutsPerWeek: number;
	isAIGenerated: boolean;
	activatedAt?: string;
	completedAt?: string;
	scheduleRules: JsonModels.ProgramPlans.ProgramPlanScheduleRuleModel[];
}
