import api from "@/lib/api";
import type { JsonData, SaveTrainingProfileRequest, TrainingProfileModel } from "@/types";

export const trainingProfileService = {
  /** Returns `data: null` until the user saves a profile for the first time. */
  async get() {
    return api.get<JsonData<TrainingProfileModel | null>>("training-profile");
  },

  async save(payload: SaveTrainingProfileRequest) {
    return api.put<JsonData<TrainingProfileModel>>("training-profile", payload);
  },
};
