import type { JsonModels } from "../../backend";

export interface WorkoutTemplateExerciseModel
{
	id: number;
	exerciseId: number;
	exerciseName: string;
	exerciseImageUrl?: string;
	orderIndex: number;
	targetSets: number;
	targetReps?: string;
	targetWeightKg?: number;
	targetRestSeconds?: number;
	tempo?: string;
	notes?: string;
	sets: JsonModels.WorkoutTemplates.WorkoutTemplateExerciseSetModel[];
}
