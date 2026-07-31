import type { JsonModels } from "../../backend";
import type { EntitlementSource } from "../Enums/EntitlementSource";
import type { SubscriptionStatus } from "../Enums/SubscriptionStatus";

export interface CurrentSubscriptionModel
{
	planId: number;
	planCode: string;
	planName: string;
	source: EntitlementSource;
	status?: SubscriptionStatus;
	currentPeriodEnd?: string;
	cancelAtPeriodEnd: boolean;
	features: JsonModels.Subscriptions.FeatureAvailabilityModel[];
}
