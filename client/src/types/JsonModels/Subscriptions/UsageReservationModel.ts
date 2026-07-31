import type { SubscriptionFeature } from "../Enums/SubscriptionFeature";
import type { UsageReservationStatus } from "../Enums/UsageReservationStatus";

export interface UsageReservationModel
{
	id: number;
	feature: SubscriptionFeature;
	quantity: number;
	status: UsageReservationStatus;
	expiresAt: string;
}
