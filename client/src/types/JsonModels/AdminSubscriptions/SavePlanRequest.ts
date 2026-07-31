import type { JsonModels } from "../../backend";

export interface SavePlanRequest
{
	code: string;
	name: string;
	description?: string;
	isActive: boolean;
	isPublic: boolean;
	sortOrder: number;
	prices: JsonModels.AdminSubscriptions.PlanPriceRequest[];
	entitlements: JsonModels.AdminSubscriptions.PlanEntitlementRequest[];
}
