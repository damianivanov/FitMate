import type { JsonModels } from "../../backend";
import type { UnsupportedRequestStatus } from "../Enums/UnsupportedRequestStatus";

export interface UnsupportedRequestQueryRequest extends JsonModels.Common.PagedRequest
{
	search?: string;
	category?: string;
	status?: UnsupportedRequestStatus;
}
