import type { JsonModels } from "../../backend";

export interface WorkoutModel
{
	id: number;
	workoutTemplateId?: number;
	templateName?: string;
	title: string;
	startedAt: string;
	finishedAt?: string;
	durationSeconds?: number;
	totalVolumeKg?: number;
	notes?: string;
	exerciseCount: number;
	setCount: number;
	groups: JsonModels.Workouts.WorkoutExerciseGroupModel[];
}
