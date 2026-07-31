import type { JsonModels } from "../../backend";

export interface SubscriptionPlanModel
{
	id: number;
	code: string;
	name: string;
	description?: string;
	sortOrder: number;
	prices: JsonModels.Subscriptions.SubscriptionPlanPriceModel[];
	features: JsonModels.Subscriptions.PlanFeatureModel[];
}
