import type { JsonModels } from "../../backend";

export interface SubscriptionPlanAdminModel
{
	id: number;
	code: string;
	name: string;
	description?: string;
	isActive: boolean;
	isPublic: boolean;
	sortOrder: number;
	subscriberCount: number;
	prices: JsonModels.AdminSubscriptions.PlanPriceAdminModel[];
	entitlements: JsonModels.AdminSubscriptions.PlanEntitlementAdminModel[];
}
