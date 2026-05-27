import api from "@/lib/api";
import type {
  JsonData,
  PreviousExerciseSetsResponse,
  SaveWorkoutRequest,
  WorkoutCreatedModel,
  WorkoutModel,
} from "@/types";

export const workoutService = {
  async list() {
    return api.get<JsonData<WorkoutModel[]>>("workouts");
  },

  async getById(id: number) {
    return api.get<JsonData<WorkoutModel>>(`workouts/${id}`);
  },

  async startFromTemplate(templateId: number) {
    return api.post<JsonData<number>>(`workouts/start-from-template/${templateId}`);
  },

  async create(payload: SaveWorkoutRequest) {
    return api.post<JsonData<WorkoutCreatedModel>>("workouts", payload);
  },

  async upsertDraft(payload: SaveWorkoutRequest) {
    return api.post<JsonData<WorkoutCreatedModel>>("workouts/draft", payload);
  },

  async remove(id: number) {
    return api.delete<JsonData<boolean>>(`workouts/${id}`);
  },

  async getPreviousSets(exerciseIds: number[]) {
    const params = new URLSearchParams();
    exerciseIds.forEach((id) => {
      params.append("exerciseIds", String(id));
    });

    return api.get<JsonData<PreviousExerciseSetsResponse>>("workouts/previous-sets", { params });
  },
};
