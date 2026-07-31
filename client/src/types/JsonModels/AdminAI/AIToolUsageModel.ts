export interface AIToolUsageModel
{
	toolName: string;
	callCount: number;
	failureCount: number;
	averageDurationMilliseconds: number;
}
