import type {
  CreateWorkoutTemplateExerciseRequest,
  CreateWorkoutTemplateExerciseSetRequest,
  CreateWorkoutTemplateRequest,
} from "@/types";
import { ExerciseGroupType } from "@/types";
import type {
  TemplateBuilderExerciseDraftModel as TemplateExerciseDraft,
} from "../models/templateBuilderDraft";

type BuildTemplatePayloadArgs = {
  templateName: string;
  templateDescription: string;
  durationMinutes: number;
  isPublic: boolean;
  exercises: readonly TemplateExerciseDraft[];
  durationEnabledExerciseIds: ReadonlySet<string>;
};

export function buildTemplatePayload({
  templateName,
  templateDescription,
  durationMinutes,
  isPublic,
  exercises,
  durationEnabledExerciseIds,
}: BuildTemplatePayloadArgs): CreateWorkoutTemplateRequest {
  const mappedExercises = exercises.map<CreateWorkoutTemplateExerciseRequest>((exercise) => {
    const isDurationEnabled = durationEnabledExerciseIds.has(exercise.id);

    const mappedSets = exercise.sets.map<CreateWorkoutTemplateExerciseSetRequest>((set) => ({
      weightKg: set.weightKg,
      reps: isDurationEnabled ? undefined : set.reps,
      durationSeconds: isDurationEnabled ? set.durationSeconds : undefined,
      distanceMeters: set.distanceMeters,
      rpe: set.rpe,
      restSeconds: set.restSeconds,
      notes: set.notes,
    }));

    return {
      groupType: typeof exercise.groupId === "number" ? exercise.groupType : ExerciseGroupType.Straight,
      clientGroupId: typeof exercise.groupId === "number" ? exercise.groupId : undefined,
      exerciseId: exercise.exerciseId,
      notes: exercise.notes,
      sets: mappedSets,
    };
  });

  return {
    name: templateName,
    description: templateDescription,
    estimatedDurationMinutes: durationMinutes,
    isPublic,
    exercises: mappedExercises,
  };
}
