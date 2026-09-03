import type { JsonModels } from "../../backend";

export interface AIActionMergeResultModel
{
	action: JsonModels.AIActions.AIActionModel;
	detail: JsonModels.AIActions.AIActionDetailModel;
}
