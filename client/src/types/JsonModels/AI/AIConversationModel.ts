import type { JsonModels } from "../../backend";
import type { AIConversationStatus } from "../Enums/AIConversationStatus";

export interface AIConversationModel
{
	id: number;
	title?: string;
	status: AIConversationStatus;
	lastMessageAt: string;
	messages: JsonModels.AI.AIMessageModel[];
}
