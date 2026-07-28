import type { ProgramPlanDayType } from "../Enums/ProgramPlanDayType";

export interface CustomProgramDayRequest
{
	date: string;
	dayType: ProgramPlanDayType;
	workoutTemplateId?: number;
	notes?: string;
}
