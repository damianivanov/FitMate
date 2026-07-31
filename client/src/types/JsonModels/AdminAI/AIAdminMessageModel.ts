import type { AIMessageRole } from "../Enums/AIMessageRole";

export interface AIAdminMessageModel
{
	id: number;
	role: AIMessageRole;
	content: string;
	toolName?: string;
	dateCreated: string;
}
