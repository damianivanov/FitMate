import type { JsonModels } from "../../backend";

export interface GridColumnOptionsModel
{
	field: string;
	options: JsonModels.Common.GridFilterOptionModel[];
}
