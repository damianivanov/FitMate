import type { DayOfWeek } from "../Enums/DayOfWeek";
import type { ProgramPlanDayType } from "../Enums/ProgramPlanDayType";

export interface ProgramScheduleRuleRequest
{
	dayOfWeek?: DayOfWeek;
	rotationDayIndex?: number;
	dayType: ProgramPlanDayType;
	workoutTemplateId?: number;
	weekInterval: number;
	orderIndex: number;
	isOptional: boolean;
}
