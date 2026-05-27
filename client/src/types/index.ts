export * from "./JsonModels";

import type { JsonModels } from "./backend";

export type Exercise = JsonModels.Exercises.ExerciseModel;
export type ExerciseLookup = JsonModels.Exercises.ExerciseLookupModel;
export type MuscleGroup = JsonModels.MuscleGroups.MuscleGroupModel;
export type PreviousExerciseSet = JsonModels.Workouts.PreviousExerciseSetModel;
export type PreviousExerciseSets = JsonModels.Workouts.PreviousExerciseSetsModel;
export type User = JsonModels.Auth.UserModel;
export type Workout = JsonModels.Workouts.WorkoutModel;
export type WorkoutCreated = JsonModels.Workouts.WorkoutCreatedModel;
export type WorkoutExercise = JsonModels.Workouts.WorkoutExerciseModel;
export type WorkoutExerciseGroup = JsonModels.Workouts.WorkoutExerciseGroupModel;
export type WorkoutSet = JsonModels.Workouts.WorkoutSetModel;
export type WorkoutTemplate = JsonModels.WorkoutTemplates.WorkoutTemplateModel;
export type WorkoutTemplateExercise = JsonModels.WorkoutTemplates.WorkoutTemplateExerciseModel;
export type WorkoutTemplateExerciseGroup = JsonModels.WorkoutTemplates.WorkoutTemplateExerciseGroupModel;
export type WorkoutTemplateExerciseSet = JsonModels.WorkoutTemplates.WorkoutTemplateExerciseSetModel;
