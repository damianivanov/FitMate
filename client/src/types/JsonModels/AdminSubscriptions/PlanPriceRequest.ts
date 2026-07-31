import type { BillingInterval } from "../Enums/BillingInterval";

export interface PlanPriceRequest
{
	currency: string;
	amount: number;
	billingInterval: BillingInterval;
	stripePriceId: string;
	isActive: boolean;
}
