import type { AIMessageRole } from "../Enums/AIMessageRole";

export interface AIMessageModel
{
	id: number;
	role: AIMessageRole;
	content: string;
	toolName?: string;
	aiRunId?: number;
	dateCreated: string;
}
