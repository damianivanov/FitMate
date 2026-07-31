import type { SubscriptionFeature } from "../Enums/SubscriptionFeature";

export interface FeatureAvailabilityModel
{
	feature: SubscriptionFeature;
	isEnabled: boolean;
	limit?: number;
	used: number;
	reserved: number;
	remaining?: number;
	resetsAt?: string;
}
