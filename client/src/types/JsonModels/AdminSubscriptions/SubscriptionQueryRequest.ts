import type { JsonModels } from "../../backend";
import type { SubscriptionStatus } from "../Enums/SubscriptionStatus";

export interface SubscriptionQueryRequest extends JsonModels.Common.PagedRequest
{
	search?: string;
	planCode?: string;
	status?: SubscriptionStatus;
	overriddenOnly: boolean;
}
