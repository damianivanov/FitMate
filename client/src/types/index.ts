export * from "./JsonModels";

import type { JsonModels } from "./backend";

export type Exercise = JsonModels.Exercises.ExerciseModel;
export type MuscleGroup = JsonModels.MuscleGroups.MuscleGroupModel;
export type User = JsonModels.Auth.UserModel;
