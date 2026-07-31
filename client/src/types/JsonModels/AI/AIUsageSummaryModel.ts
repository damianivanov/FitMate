export interface AIUsageSummaryModel
{
	feature: string;
	used: number;
	limit?: number;
	remaining?: number;
}
