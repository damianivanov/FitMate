export type ExerciseFormValues = {
  name: string;
  slug: string;
  description: string;
  primaryMuscleGroupId: string;
  secondaryMuscleGroupId: string;
  isPublic: boolean;
  /** "" or the numeric enum value as a string. */
  equipment: string;
  movementPattern: string;
  difficulty: string;
  category: string;
  loadBasis: string;
  aliases: string[];
};

export const emptyExerciseFormValues: ExerciseFormValues = {
  name: "",
  slug: "",
  description: "",
  primaryMuscleGroupId: "",
  secondaryMuscleGroupId: "",
  isPublic: true,
  equipment: "",
  movementPattern: "",
  difficulty: "",
  category: "",
  loadBasis: "",
  aliases: [],
};
