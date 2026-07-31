import type { DayOfWeek } from "../Enums/DayOfWeek";
import type { TrainingExperienceLevel } from "../Enums/TrainingExperienceLevel";
import type { TrainingGoal } from "../Enums/TrainingGoal";
import type { WeightUnit } from "../Enums/WeightUnit";

export interface SaveTrainingProfileRequest
{
	goal: TrainingGoal;
	experienceLevel: TrainingExperienceLevel;
	preferredTrainingDaysPerWeek: number;
	preferredWorkoutDurationMinutes?: number;
	weightUnit: WeightUnit;
	availableEquipment: string[];
	preferredTrainingDays: DayOfWeek[];
	exerciseRestrictions?: string;
	additionalPreferences?: string;
	allowAIPersonalization: boolean;
}
