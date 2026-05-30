import { AxiosError } from "axios";
import api from "@/lib/api";
import type {
  CreateTemplateFromWorkoutRequest,
  CreateWorkoutTemplateRequest,
  JsonData,
  WorkoutTemplateModel,
} from "@/types";

function isNotFoundError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 404;
}

export const workoutTemplateService = {
  async list() {
    return api.get<JsonData<WorkoutTemplateModel[]>>("workout-templates");
  },

  async getById(id: number) {
    return api.get<JsonData<WorkoutTemplateModel>>(`workout-templates/${id}`);
  },

  async getByIdWithListFallback(id: number) {
    try {
      return await this.getById(id);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }

      const response = await this.list();
      const result = response.data;
      const template = result.data?.find((item) => item.id === id);

      if (!result.success || !template) {
        throw error;
      }

      return {
        ...response,
        data: {
          success: true,
          data: template,
        },
      };
    }
  },

  async create(payload: CreateWorkoutTemplateRequest) {
    return api.post<JsonData<WorkoutTemplateModel>>("workout-templates", payload);
  },

  async update(id: number, payload: CreateWorkoutTemplateRequest) {
    return api.put<JsonData<WorkoutTemplateModel>>(`workout-templates/${id}`, payload);
  },

  async createFromWorkout(workoutId: number, payload: CreateTemplateFromWorkoutRequest) {
    return api.post<JsonData<WorkoutTemplateModel>>(
      `workout-templates/from-workout/${workoutId}`,
      payload,
    );
  },
};
