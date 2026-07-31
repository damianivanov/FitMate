import type { JsonModels } from "../../backend";

export interface AIActionPreviewModel
{
	title: string;
	subtitle?: string;
	lines: JsonModels.AIActions.AIActionPreviewLineModel[];
}
