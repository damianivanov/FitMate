import api from "@/lib/api";
import type {
  AnalyticsOverview,
  AnalyticsQueryRequest,
  ExerciseProgression,
  JsonData,
} from "@/types";

function buildRangeParams(range?: AnalyticsQueryRequest): URLSearchParams {
  const params = new URLSearchParams();
  if (range?.from) {
    params.append("from", range.from);
  }
  if (range?.to) {
    params.append("to", range.to);
  }

  return params;
}

export const analyticsService = {
  async getOverview(range?: AnalyticsQueryRequest) {
    return api.get<JsonData<AnalyticsOverview>>("analytics/overview", {
      params: buildRangeParams(range),
    });
  },

  async getExerciseProgression(exerciseId: number, range?: AnalyticsQueryRequest) {
    const params = buildRangeParams(range);
    params.append("exerciseId", String(exerciseId));

    return api.get<JsonData<ExerciseProgression>>("analytics/exercise-progression", {
      params,
    });
  },
};
