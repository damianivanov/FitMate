export type AnalyticsRangePreset = "all" | "4w" | "12w" | "1y";

export type AnalyticsTab = "exercise" | "overview" | "muscles" | "records";

export type ProgressionMetric = "oneRepMax" | "topWeight" | "volume";

export type AnalyticsExerciseSelection = {
  id: number;
  name: string;
  muscleGroupName?: string;
  imageUrl?: string;
};

export type ProgressionChange = {
  delta: number;
  percent: number | null;
  since: string;
};
