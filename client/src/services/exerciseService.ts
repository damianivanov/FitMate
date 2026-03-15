import api from "@/lib/api";
import type {
  Exercise,
  ExerciseQueryRequest,
  ExerciseLookupModel,
  ExerciseLookupRequest,
  JsonData,
  PagedResponse,
  CreateExerciseRequest,
} from "@/types";

export const exerciseService = {
  async lookup(params: ExerciseLookupRequest) {
    return api.get<JsonData<ExerciseLookupModel[]>>("exercises/lookup", { params });
  },

  async list(params: ExerciseQueryRequest) {
    return api.get<JsonData<PagedResponse<Exercise>>>("admin/exercises", { params });
  },

  async getById(id: number) {
    return api.get<JsonData<Exercise>>(`admin/exercises/${id}`);
  },

  async create(payload: CreateExerciseRequest) {
    return api.post<JsonData<Exercise>>("admin/exercises", payload);
  },

  async createGlobal(payload: CreateExerciseRequest) {
    return api.post<JsonData<Exercise>>("exercises/global", payload);
  },

  async update(id: number, payload: CreateExerciseRequest) {
    return api.put<JsonData<Exercise>>(`admin/exercises/${id}`, payload);
  },

  async remove(id: number) {
    return api.delete<JsonData<boolean>>(`admin/exercises/${id}`);
  },
};
