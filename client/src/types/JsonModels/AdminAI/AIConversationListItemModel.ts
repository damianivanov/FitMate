import type { AIConversationStatus } from "../Enums/AIConversationStatus";

export interface AIConversationListItemModel
{
	id: number;
	userId: number;
	userEmail?: string;
	title?: string;
	status: AIConversationStatus;
	messageCount: number;
	runCount: number;
	estimatedCost: number;
	lastMessageAt: string;
	dateCreated: string;
}
