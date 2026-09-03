import type { ExerciseSetType } from "../Enums/ExerciseSetType";

export interface AIProposalSetModel
{
	setType: ExerciseSetType;
	reps?: number;
	weightKg?: number;
	rpe?: number;
	restSeconds?: number;
}
