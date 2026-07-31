export interface RecordUnsupportedRequestRequest
{
	category: string;
	requestedFunctionality: string;
	userIntentSummary?: string;
	suggestedFallback?: string;
	conversationId: number;
	messageId?: number;
}
