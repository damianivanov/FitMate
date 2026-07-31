import type { UnsupportedRequestStatus } from "../Enums/UnsupportedRequestStatus";

export interface UpdateUnsupportedRequestRequest
{
	status: UnsupportedRequestStatus;
	adminNotes?: string;
	externalTrackingUrl?: string;
	externalTrackingKey?: string;
}
