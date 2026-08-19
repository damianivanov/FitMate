import type { JsonModels } from "../../backend";
import type { ExerciseLoadBasis } from "../Enums/ExerciseLoadBasis";

export interface WorkoutTemplateExerciseModel
{
	id: number;
	exerciseId: number;
	exerciseName: string;
	exerciseImageUrl?: string;
	exerciseLoadBasis?: ExerciseLoadBasis;
	orderIndex: number;
	targetSets: number;
	targetReps?: string;
	targetWeightKg?: number;
	targetRestSeconds?: number;
	tempo?: string;
	notes?: string;
	sets: JsonModels.WorkoutTemplates.WorkoutTemplateExerciseSetModel[];
}
