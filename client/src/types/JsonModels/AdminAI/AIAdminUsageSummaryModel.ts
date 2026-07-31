import type { JsonModels } from "../../backend";

export interface AIAdminUsageSummaryModel
{
	period: string;
	features: JsonModels.AdminAI.AIAdminFeatureUsageModel[];
}
