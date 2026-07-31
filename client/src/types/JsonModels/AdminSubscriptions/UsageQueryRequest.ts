import type { JsonModels } from "../../backend";
import type { SubscriptionFeature } from "../Enums/SubscriptionFeature";

export interface UsageQueryRequest extends JsonModels.Common.PagedRequest
{
	search?: string;
	userId?: number;
	feature?: SubscriptionFeature;
	periodStart?: string;
	atLimitOnly: boolean;
}
