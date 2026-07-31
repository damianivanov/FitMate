import type { JsonModels } from "../../backend";

export interface AIActionValidationSummaryModel
{
	warnings: string[];
	errors: string[];
	duplicateCandidates: JsonModels.AIActions.DuplicateCandidateModel[];
}
