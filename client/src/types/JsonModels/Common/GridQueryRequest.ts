import type { JsonModels } from "../../backend";

export interface GridQueryRequest extends JsonModels.Common.PagedRequest
{
	columnFilters?: JsonModels.Common.GridColumnSelectionModel[];
}
