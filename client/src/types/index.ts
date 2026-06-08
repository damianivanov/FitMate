export * from "./JsonModels";

import type { JsonModels } from "./backend";

export type AdminUser = JsonModels.Users.AdminUserModel;
export type AnalyticsOverview = JsonModels.Analytics.AnalyticsOverviewModel;
export type Exercise = JsonModels.Exercises.ExerciseModel;
export type ExerciseLookup = JsonModels.Exercises.ExerciseLookupModel;
export type ExerciseProgression = JsonModels.Analytics.ExerciseProgressionModel;
export type ExerciseProgressionPoint = JsonModels.Analytics.ExerciseProgressionPointModel;
export type MuscleGroup = JsonModels.MuscleGroups.MuscleGroupModel;
export type MuscleGroupVolume = JsonModels.Analytics.MuscleGroupVolumeModel;
export type PersonalRecordSummary = JsonModels.Analytics.PersonalRecordSummaryModel;
export type PreviousExerciseSet = JsonModels.Workouts.PreviousExerciseSetModel;
export type PreviousExerciseSets = JsonModels.Workouts.PreviousExerciseSetsModel;
export type User = JsonModels.Auth.UserModel;
export type VolumeTrendPoint = JsonModels.Analytics.VolumeTrendPointModel;
export type Workout = JsonModels.Workouts.WorkoutModel;
export type WorkoutCalendarDay = JsonModels.Workouts.WorkoutCalendarDayModel;
export type WorkoutCreated = JsonModels.Workouts.WorkoutCreatedModel;
export type WorkoutExercise = JsonModels.Workouts.WorkoutExerciseModel;
export type WorkoutExerciseGroup = JsonModels.Workouts.WorkoutExerciseGroupModel;
export type WorkoutSet = JsonModels.Workouts.WorkoutSetModel;
export type WorkoutTemplate = JsonModels.WorkoutTemplates.WorkoutTemplateModel;
export type WorkoutTemplateExercise = JsonModels.WorkoutTemplates.WorkoutTemplateExerciseModel;
export type WorkoutTemplateExerciseGroup = JsonModels.WorkoutTemplates.WorkoutTemplateExerciseGroupModel;
export type WorkoutTemplateExerciseSet = JsonModels.WorkoutTemplates.WorkoutTemplateExerciseSetModel;
