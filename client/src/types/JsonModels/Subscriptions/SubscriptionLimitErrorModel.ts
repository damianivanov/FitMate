import type { SubscriptionFeature } from "../Enums/SubscriptionFeature";

export interface SubscriptionLimitErrorModel
{
	code: string;
	feature: SubscriptionFeature;
	limit?: number;
	used: number;
	reserved: number;
	resetsAt?: string;
	upgradeAvailable: boolean;
}
