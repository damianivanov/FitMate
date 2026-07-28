import type { ProgramPlanDayStatus } from "../Enums/ProgramPlanDayStatus";
import type { ProgramPlanDayType } from "../Enums/ProgramPlanDayType";

export interface ProgramPlanDayModel
{
	id: number;
	programPlanId: number;
	scheduledDate: string;
	originalScheduledDate?: string;
	dayType: ProgramPlanDayType;
	status: ProgramPlanDayStatus;
	workoutTemplateId?: number;
	workoutTemplateName?: string;
	estimatedDurationMinutes?: number;
	exerciseCount: number;
	startedWorkoutId?: number;
	completedWorkoutId?: number;
	notes?: string;
}
