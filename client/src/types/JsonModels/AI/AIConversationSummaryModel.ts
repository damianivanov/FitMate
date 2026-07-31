import type { AIConversationStatus } from "../Enums/AIConversationStatus";

export interface AIConversationSummaryModel
{
	id: number;
	title?: string;
	status: AIConversationStatus;
	lastMessageAt: string;
	messageCount: number;
}
