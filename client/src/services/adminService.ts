import api from "@/lib/api";
import type {
  AdminUserModel,
  CreateMuscleGroupRequest,
  Exercise,
  ExerciseQueryRequest,
  JsonData,
  MuscleGroup,
  MuscleGroupQueryRequest,
  PagedResponse,
  UpdateUserRequest,
  UserQueryRequest,
} from "@/types";

export const adminService = {
  users: {
    async list(params: UserQueryRequest) {
      return api.get<JsonData<PagedResponse<AdminUserModel>>>("admin/users", { params });
    },

    async update(id: number, payload: UpdateUserRequest) {
      return api.put<JsonData<AdminUserModel>>(`admin/users/${id}`, payload);
    },

    async remove(id: number) {
      return api.delete<JsonData<boolean>>(`admin/users/${id}`);
    },
  },

  muscleGroups: {
    async list(params: MuscleGroupQueryRequest) {
      return api.get<JsonData<PagedResponse<MuscleGroup>>>("admin/musclegroups", { params });
    },

    async update(id: number, payload: CreateMuscleGroupRequest) {
      return api.put<JsonData<MuscleGroup>>(`admin/musclegroups/${id}`, payload);
    },

    async remove(id: number) {
      return api.delete<JsonData<boolean>>(`admin/musclegroups/${id}`);
    },
  },

  exercises: {
    async list(params: ExerciseQueryRequest) {
      return api.get<JsonData<PagedResponse<Exercise>>>("admin/exercises", { params });
    },
  },
};
