import api from "@/lib/api";
import type { JsonData, MuscleGroup } from "@/types";

export const muscleGroupService = {
  async getLookup() {
    return api.get<JsonData<MuscleGroup[]>>("musclegroups/lookup");
  },
};
