import type { JsonModels } from "../../backend";

export interface ProgramTodayModel
{
	date: string;
	hasActiveProgram: boolean;
	programId?: number;
	programName?: string;
	today?: JsonModels.ProgramPlans.ProgramPlanDayModel;
	missedWorkout?: JsonModels.ProgramPlans.ProgramPlanDayModel;
	nextWorkout?: JsonModels.ProgramPlans.ProgramPlanDayModel;
}
