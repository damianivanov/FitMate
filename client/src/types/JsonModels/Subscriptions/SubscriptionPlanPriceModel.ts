import type { BillingInterval } from "../Enums/BillingInterval";

export interface SubscriptionPlanPriceModel
{
	id: number;
	currency: string;
	amount: number;
	billingInterval: BillingInterval;
}
