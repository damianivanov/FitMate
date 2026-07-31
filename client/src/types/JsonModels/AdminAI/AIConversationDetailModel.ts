import type { JsonModels } from "../../backend";
import type { AIConversationStatus } from "../Enums/AIConversationStatus";

export interface AIConversationDetailModel
{
	id: number;
	userId: number;
	userEmail?: string;
	title?: string;
	status: AIConversationStatus;
	lastMessageAt: string;
	dateCreated: string;
	contentVisible: boolean;
	messages: JsonModels.AdminAI.AIAdminMessageModel[];
	runs: JsonModels.AdminAI.AIAdminRunModel[];
	actions: JsonModels.AdminAI.AIAdminActionModel[];
}
