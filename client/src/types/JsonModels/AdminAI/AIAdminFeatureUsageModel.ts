import type { SubscriptionFeature } from "../Enums/SubscriptionFeature";

export interface AIAdminFeatureUsageModel
{
	feature: SubscriptionFeature;
	userCount: number;
	usedTotal: number;
	atOrOverLimitCount: number;
}
