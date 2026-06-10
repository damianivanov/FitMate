import api from "@/lib/api";
import type { BodyMetricEntry, JsonData, LogBodyMetricRequest } from "@/types";

export const bodyMetricService = {
  async list() {
    return api.get<JsonData<BodyMetricEntry[]>>("body-metrics");
  },

  async log(payload: LogBodyMetricRequest) {
    return api.post<JsonData<BodyMetricEntry>>("body-metrics", payload);
  },

  async remove(id: number) {
    return api.delete<JsonData<boolean>>(`body-metrics/${id}`);
  },
};
