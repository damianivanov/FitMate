import api from "@/lib/api";
import type {
  CreateWorkoutRequest,
  JsonData,
  PreviousExerciseSetsResponse,
  WorkoutCreatedModel,
} from "@/types";

export const workoutService = {
  async create(payload: CreateWorkoutRequest) {
    return api.post<JsonData<WorkoutCreatedModel>>("workouts", payload);
  },

  async getPreviousSets(exerciseIds: number[]) {
    const params = new URLSearchParams();
    exerciseIds.forEach((id) => {
      params.append("exerciseIds", String(id));
    });

    return api.get<JsonData<PreviousExerciseSetsResponse>>("workouts/previous-sets", { params });
  },
};
