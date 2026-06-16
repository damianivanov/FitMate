import api from "@/lib/api";
import { compressImageForUpload } from "@/lib/imageCompression";
import type {
  Exercise,
  ExerciseLookupModel,
  ExerciseLookupRequest,
  JsonData,
  CreateExerciseRequest,
} from "@/types";

export const exerciseService = {
  async getAll(params: ExerciseLookupRequest) {
    return api.get<JsonData<ExerciseLookupModel[]>>("exercises/get-all", {
      params,
      paramsSerializer: { indexes: null },
    });
  },

  async getMine(params: ExerciseLookupRequest) {
    return api.get<JsonData<ExerciseLookupModel[]>>("exercises/mine", {
      params,
      paramsSerializer: { indexes: null },
    });
  },

  async create(payload: CreateExerciseRequest, file?: File) {
    const formData = new FormData();
    formData.append("name", payload.name);
    formData.append("primaryMuscleGroupId", String(payload.primaryMuscleGroupId));
    formData.append("isPublic", String(payload.isPublic));

    if (payload.description) {
      formData.append("description", payload.description);
    }

    if (payload.secondaryMuscleGroupId != null) {
      formData.append("secondaryMuscleGroupId", String(payload.secondaryMuscleGroupId));
    }

    if (file) {
      formData.append("file", await compressImageForUpload(file));
    }

    return api.post<JsonData<Exercise>>("exercises", formData);
  },

  async update(id: number, payload: CreateExerciseRequest) {
    return api.put<JsonData<Exercise>>(`exercises/${id}`, payload);
  },

  async remove(id: number) {
    return api.delete<JsonData<boolean>>(`exercises/${id}`);
  },

  async uploadImage(id: number, file: File) {
    const formData = new FormData();
    formData.append("file", await compressImageForUpload(file));
    return api.post<JsonData<Exercise>>(`exercises/${id}/image`, formData);
  },
};
