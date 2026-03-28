import api from "@/lib/api";
import type {
  CreateWorkoutTemplateRequest,
  JsonData,
  WorkoutTemplateModel,
} from "@/types";

export const workoutTemplateService = {
  async list() {
    return api.get<JsonData<WorkoutTemplateModel[]>>("workout-templates");
  },

  async create(payload: CreateWorkoutTemplateRequest) {
    return api.post<JsonData<WorkoutTemplateModel>>("workout-templates", payload);
  },
};
