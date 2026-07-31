import type { JsonModels } from "../../backend";
import type { EntitlementSource } from "../Enums/EntitlementSource";
import type { SubscriptionStatus } from "../Enums/SubscriptionStatus";

export interface UserSubscriptionAdminModel
{
	userId: number;
	email?: string;
	fullName?: string;
	effectivePlanCode: string;
	effectivePlanName: string;
	source: EntitlementSource;
	subscriptionId?: number;
	subscriptionStatus?: SubscriptionStatus;
	currentPeriodEnd?: string;
	cancelAtPeriodEnd: boolean;
	activeOverride?: JsonModels.AdminSubscriptions.PlanOverrideAdminModel;
}
