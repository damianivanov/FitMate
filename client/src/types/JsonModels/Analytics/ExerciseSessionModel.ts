import type { JsonModels } from "../../backend";

export interface ExerciseSessionModel
{
	workoutId: number;
	workoutTitle: string;
	date: string;
	totalVolumeKg: number;
	bestWeightKg?: number;
	estimatedOneRepMax?: number;
	isPersonalRecord: boolean;
	sets: JsonModels.Analytics.ExerciseSessionSetModel[];
}
