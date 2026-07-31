import type { SubscriptionFeature } from "../Enums/SubscriptionFeature";

export interface PlanFeatureModel
{
	feature: SubscriptionFeature;
	isEnabled: boolean;
	monthlyLimit?: number;
	hardLimit?: number;
}
