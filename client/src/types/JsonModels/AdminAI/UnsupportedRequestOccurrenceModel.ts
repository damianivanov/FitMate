export interface UnsupportedRequestOccurrenceModel
{
	id: number;
	userId: number;
	userEmail?: string;
	conversationId: number;
	reportedAt: string;
}
