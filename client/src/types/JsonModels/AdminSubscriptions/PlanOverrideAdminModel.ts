export interface PlanOverrideAdminModel
{
	id: number;
	planCode: string;
	reason: string;
	createdByUserId: number;
	startsAt: string;
	endsAt?: string;
}
