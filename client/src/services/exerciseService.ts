import api from "@/lib/api";
import type {
  Exercise,
  ExerciseQueryRequest,
  JsonData,
  PagedResponse,
  CreateExerciseRequest,
} from "@/types";

export const exerciseService = {
  async list(params: ExerciseQueryRequest) {
    return api.get<JsonData<PagedResponse<Exercise>>>("admin/exercises", { params });
  },

  async getById(id: number) {
    return api.get<JsonData<Exercise>>(`admin/exercises/${id}`);
  },

  async create(payload: CreateExerciseRequest) {
    return api.post<JsonData<Exercise>>("admin/exercises", payload);
  },

  async update(id: number, payload: CreateExerciseRequest) {
    return api.put<JsonData<Exercise>>(`admin/exercises/${id}`, payload);
  },

  async remove(id: number) {
    return api.delete<JsonData<string>>(`admin/exercises/${id}`);
  },
};
