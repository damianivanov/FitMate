import type { BillingInterval } from "../Enums/BillingInterval";

export interface PlanPriceAdminModel
{
	id: number;
	currency: string;
	amount: number;
	billingInterval: BillingInterval;
	stripePriceId: string;
	isActive: boolean;
}
