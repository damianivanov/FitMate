import api from "@/lib/api";
import type {
  CreateMuscleGroupRequest,
  JsonData,
  MuscleGroup,
  MuscleGroupQueryRequest,
  PagedResponse,
} from "@/types";

export const muscleGroupService = {
  async getLookup() {
    return api.get<JsonData<MuscleGroup[]>>("musclegroups/lookup");
  },

  async list(params: MuscleGroupQueryRequest) {
    return api.get<JsonData<PagedResponse<MuscleGroup>>>("admin/musclegroups", { params });
  },

  async getById(id: number) {
    return api.get<JsonData<MuscleGroup>>(`admin/musclegroups/${id}`);
  },

  async create(payload: CreateMuscleGroupRequest) {
    return api.post<JsonData<MuscleGroup>>("admin/musclegroups", payload);
  },

  async update(id: number, payload: CreateMuscleGroupRequest) {
    return api.put<JsonData<MuscleGroup>>(`admin/musclegroups/${id}`, payload);
  },

  async remove(id: number) {
    return api.delete<JsonData<boolean>>(`admin/musclegroups/${id}`);
  },
};
