import type { DayOfWeek } from "../Enums/DayOfWeek";
import type { ProgramPlanDayType } from "../Enums/ProgramPlanDayType";

export interface ProgramPlanScheduleRuleModel
{
	id: number;
	dayOfWeek?: DayOfWeek;
	rotationDayIndex?: number;
	dayType: ProgramPlanDayType;
	workoutTemplateId?: number;
	workoutTemplateName?: string;
	weekInterval: number;
	orderIndex: number;
	isOptional: boolean;
}
