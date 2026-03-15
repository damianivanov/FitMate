export * from "./JsonModels";

import type { JsonModels } from "./backend";

export type Exercise = JsonModels.Exercises.ExerciseModel;
export type ExerciseLookup = JsonModels.Exercises.ExerciseLookupModel;
export type MuscleGroup = JsonModels.MuscleGroups.MuscleGroupModel;
export type PreviousExerciseSet = JsonModels.Workouts.PreviousExerciseSetModel;
export type PreviousExerciseSets = JsonModels.Workouts.PreviousExerciseSetsModel;
export type User = JsonModels.Auth.UserModel;
export type WorkoutCreated = JsonModels.Workouts.WorkoutCreatedModel;
