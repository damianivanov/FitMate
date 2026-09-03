import type { JsonModels } from "../../backend";
import type { ExerciseEquipment } from "../Enums/ExerciseEquipment";

export interface AIProposalExerciseModel
{
	exerciseId: number;
	name: string;
	imageUrl?: string;
	primaryMuscleGroupName?: string;
	secondaryMuscleGroupName?: string;
	equipment?: ExerciseEquipment;
	isNew: boolean;
	sets: JsonModels.AIActions.AIProposalSetModel[];
}
