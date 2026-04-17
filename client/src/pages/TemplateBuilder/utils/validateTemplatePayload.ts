import type {
  CreateWorkoutTemplateExerciseRequest,
  CreateWorkoutTemplateExerciseSetRequest,
  CreateWorkoutTemplateRequest,
} from "@/types";
import type {
  TemplateBuilderExerciseDraftModel as TemplateExerciseDraft,
  TemplateSetNumericValue,
} from "../models/templateBuilderDraft";

type ValidateTemplatePayloadArgs = {
  templateName: string;
  templateDescription: string;
  durationMinutes: number;
  isPublic: boolean;
  exercises: readonly TemplateExerciseDraft[];
  durationEnabledExerciseIds: ReadonlySet<string>;
  getExerciseDisplayName: (exerciseId: number) => string;
};

type ValidateTemplatePayloadResult =
  | {
      payload: CreateWorkoutTemplateRequest;
      error: null;
    }
  | {
      payload: null;
      error: string;
    };

function toOptionalNumber(value: TemplateSetNumericValue): number | undefined {
  return value;
}

export function validateTemplatePayload({
  templateName,
  templateDescription,
  durationMinutes,
  isPublic,
  exercises,
  durationEnabledExerciseIds,
  getExerciseDisplayName,
}: ValidateTemplatePayloadArgs): ValidateTemplatePayloadResult {
  const normalizedName = templateName.trim();
  if (!normalizedName) {
    return {
      payload: null,
      error: "Template name is required.",
    };
  }

  if (!exercises.length) {
    return {
      payload: null,
      error: "Add at least one exercise.",
    };
  }

  const mappedExercises: CreateWorkoutTemplateExerciseRequest[] = [];
  const seenExerciseIds = new Set<number>();

  for (const exercise of exercises) {
    const exerciseDisplayName = getExerciseDisplayName(exercise.exerciseId);
    const isDurationEnabled = durationEnabledExerciseIds.has(exercise.id);

    if (exercise.exerciseId <= 0) {
      return {
        payload: null,
        error: "Each exercise must be selected from your library.",
      };
    }

    if (seenExerciseIds.has(exercise.exerciseId)) {
      return {
        payload: null,
        error: "Duplicate exercises are not supported in one template.",
      };
    }

    seenExerciseIds.add(exercise.exerciseId);

    if (exercise.sets.length === 0) {
      return {
        payload: null,
        error: `Exercise "${exerciseDisplayName}" must include at least one set.`,
      };
    }

    const mappedSets: CreateWorkoutTemplateExerciseSetRequest[] = [];

    for (const set of exercise.sets) {
      const parsedWeightKg = toOptionalNumber(set.weightKg);
      const parsedReps = isDurationEnabled ? undefined : toOptionalNumber(set.reps);
      const parsedDuration = isDurationEnabled ? toOptionalNumber(set.durationSeconds) : undefined;
      const parsedDistance = toOptionalNumber(set.distanceMeters);
      const parsedRest = toOptionalNumber(set.restSeconds);

      if (parsedWeightKg !== undefined && (!Number.isFinite(parsedWeightKg) || parsedWeightKg < 0)) {
        return {
          payload: null,
          error: `Set weight cannot be negative in "${exerciseDisplayName}".`,
        };
      }

      if (parsedReps !== undefined && (!Number.isFinite(parsedReps) || parsedReps <= 0)) {
        return {
          payload: null,
          error: `Set reps must be greater than zero in "${exerciseDisplayName}".`,
        };
      }

      if (parsedDuration !== undefined && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) {
        return {
          payload: null,
          error: `Set duration must be greater than zero in "${exerciseDisplayName}".`,
        };
      }

      if (parsedDistance !== undefined && (!Number.isFinite(parsedDistance) || parsedDistance <= 0)) {
        return {
          payload: null,
          error: `Set distance must be greater than zero in "${exerciseDisplayName}".`,
        };
      }

      if (parsedRest !== undefined && (!Number.isFinite(parsedRest) || parsedRest < 0)) {
        return {
          payload: null,
          error: `Set rest cannot be negative in "${exerciseDisplayName}".`,
        };
      }

      const hasMetric =
        parsedWeightKg !== undefined
        || parsedReps !== undefined
        || parsedDuration !== undefined
        || parsedDistance !== undefined;

      if (!hasMetric) {
        return {
          payload: null,
          error: `Each set in "${exerciseDisplayName}" must include at least weight, reps, duration, or distance.`,
        };
      }

      mappedSets.push({
        weightKg: parsedWeightKg,
        reps: parsedReps,
        durationSeconds: parsedDuration,
        distanceMeters: parsedDistance,
        restSeconds: parsedRest,
        notes: set.notes.trim().length > 0 ? set.notes.trim() : undefined,
      });
    }

    mappedExercises.push({
      groupType: exercise.groupType,
      exerciseId: exercise.exerciseId,
      notes: exercise.notes.trim().length > 0 ? exercise.notes.trim() : undefined,
      sets: mappedSets,
    });
  }

  return {
    payload: {
      name: normalizedName,
      description: templateDescription.trim().length > 0 ? templateDescription.trim() : undefined,
      estimatedDurationMinutes: durationMinutes,
      isPublic,
      exercises: mappedExercises,
    },
    error: null,
  };
}
