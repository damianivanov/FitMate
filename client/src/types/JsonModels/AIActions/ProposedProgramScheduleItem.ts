import type { DayOfWeek } from "../Enums/DayOfWeek";
import type { ProgramPlanDayType } from "../Enums/ProgramPlanDayType";

export interface ProposedProgramScheduleItem
{
	dayOfWeek?: DayOfWeek;
	rotationDayIndex?: number;
	dayType: ProgramPlanDayType;
	existingWorkoutTemplateId?: number;
	newWorkoutTemplateClientKey?: string;
	isOptional: boolean;
}
