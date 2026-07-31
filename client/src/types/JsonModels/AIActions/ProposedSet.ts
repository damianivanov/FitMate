import type { ExerciseSetType } from "../Enums/ExerciseSetType";

export interface ProposedSet
{
	setType: ExerciseSetType;
	reps?: number;
	weightKg?: number;
	rpe?: number;
	restSeconds?: number;
}
