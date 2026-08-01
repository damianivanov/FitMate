export interface SaveAISettingsRequest
{
	defaultModel: string;
	fastModel: string;
	reasoningModel: string;
	visionModel: string;
	imageModel: string;
	timeoutSeconds: number;
	maximumToolIterations: number;
	maximumToolCallsPerRun: number;
	maximumConversationMessages: number;
	maximumContextTokens: number;
	maximumOutputTokens: number;
	maximumMessageCharacters: number;
	storeRawProviderPayload: boolean;
}
