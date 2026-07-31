import type { SubscriptionFeature } from "../Enums/SubscriptionFeature";

export interface PlanEntitlementAdminModel
{
	id: number;
	feature: SubscriptionFeature;
	isEnabled: boolean;
	dailyLimit?: number;
	monthlyLimit?: number;
	maximumPerRequest?: number;
	softLimit?: number;
	hardLimit?: number;
}
