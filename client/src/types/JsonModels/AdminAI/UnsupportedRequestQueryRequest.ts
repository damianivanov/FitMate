import type { JsonModels } from "../../backend";
import type { UnsupportedRequestStatus } from "../Enums/UnsupportedRequestStatus";

export interface UnsupportedRequestQueryRequest extends JsonModels.Common.GridQueryRequest
{
	search?: string;
	category?: string;
	status?: UnsupportedRequestStatus;
}
