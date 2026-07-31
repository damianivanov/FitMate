import type { SubscriptionFeature } from "../Enums/SubscriptionFeature";

export interface UserUsageAdminModel
{
	id: number;
	userId: number;
	email?: string;
	feature: SubscriptionFeature;
	periodStart: string;
	periodEnd: string;
	used: number;
	reserved: number;
	effectiveLimit?: number;
}
