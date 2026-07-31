import type { JsonModels } from "../../backend";
import type { UnsupportedRequestStatus } from "../Enums/UnsupportedRequestStatus";

export interface UnsupportedAIRequestModel
{
	id: number;
	category: string;
	normalizedKey: string;
	requestedFunctionality: string;
	userIntentSummary?: string;
	suggestedFallback?: string;
	status: UnsupportedRequestStatus;
	occurrenceCount: number;
	distinctUserCount: number;
	firstRequestedAt: string;
	lastRequestedAt: string;
	adminNotes?: string;
	externalTrackingUrl?: string;
	externalTrackingKey?: string;
	recentOccurrences: JsonModels.AdminAI.UnsupportedRequestOccurrenceModel[];
}
