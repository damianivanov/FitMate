import { useCallback, useEffect, useMemo, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { useMuscleGroups } from "@/hooks/useMuscleGroups";
import { analyticsService } from "@/services/analyticsService";
import type {
  AnalyticsOverview,
  AnalyticsQueryRequest,
  ExerciseLookupModel,
  ExerciseProgression,
} from "@/types";
import { toProgressionPoints, toVolumePoints } from "../utils/analyticsFormat";

export type AnalyticsRangePreset = "all" | "4w" | "12w" | "1y";
export type AnalyticsTab = "overview" | "progression" | "muscleGroups" | "records";

const RANGE_DAYS: Record<AnalyticsRangePreset, number | null> = {
  all: null,
  "4w": 28,
  "12w": 84,
  "1y": 365,
};

function buildRange(preset: AnalyticsRangePreset): AnalyticsQueryRequest {
  const days = RANGE_DAYS[preset];
  if (days == null) {
    return {};
  }

  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString() };
}

export function useAnalyticsPage() {
  const [rangePreset, setRangePreset] = useState<AnalyticsRangePreset>("12w");
  const range = useMemo(() => buildRange(rangePreset), [rangePreset]);

  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");

  const [searchValue, setSearchValue] = useState("");
  const [muscleGroupFilterId, setMuscleGroupFilterId] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<ExerciseLookupModel | null>(null);

  const [recordsMuscleGroupId, setRecordsMuscleGroupId] = useState("");

  const { muscleGroups } = useMuscleGroups();

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    async function loadOverview() {
      setIsLoadingOverview(true);
      setOverviewError(null);

      try {
        const response = await analyticsService.getOverview(range);
        setOverview(unwrap(response.data, "Unable to load analytics."));
      } catch (loadError) {
        setOverviewError(loadError instanceof Error ? loadError.message : "Unable to load analytics.");
        setOverview(null);
      } finally {
        setIsLoadingOverview(false);
      }
    }

    void loadOverview();
  }, [range, reloadIndex]);

  const [progression, setProgression] = useState<ExerciseProgression | null>(null);
  const [isLoadingProgression, setIsLoadingProgression] = useState(false);
  const [progressionError, setProgressionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProgression() {
      if (!selectedExercise) {
        setProgression(null);
        setProgressionError(null);
        setIsLoadingProgression(false);
        return;
      }

      setIsLoadingProgression(true);
      setProgressionError(null);

      try {
        const response = await analyticsService.getExerciseProgression(selectedExercise.id, range);
        setProgression(unwrap(response.data, "Unable to load progression."));
      } catch (loadError) {
        setProgressionError(loadError instanceof Error ? loadError.message : "Unable to load progression.");
        setProgression(null);
      } finally {
        setIsLoadingProgression(false);
      }
    }

    void loadProgression();
  }, [selectedExercise, range]);

  const setRange = useCallback((preset: AnalyticsRangePreset) => {
    setRangePreset(preset);
  }, []);

  const search = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const filterByMuscleGroup = useCallback((value: string) => {
    setMuscleGroupFilterId(value);
  }, []);

  const selectExercise = useCallback((exercise: ExerciseLookupModel) => {
    setSelectedExercise(exercise);
  }, []);

  const clearExercise = useCallback(() => {
    setSelectedExercise(null);
    setSearchValue("");
  }, []);

  const selectTab = useCallback((tab: AnalyticsTab) => {
    setActiveTab(tab);
  }, []);

  const filterRecordsByMuscleGroup = useCallback((value: string) => {
    setRecordsMuscleGroupId(value);
  }, []);

  const volumePoints = useMemo(() => toVolumePoints(overview), [overview]);
  const progressionPoints = useMemo(() => toProgressionPoints(progression), [progression]);

  const personalRecords = useMemo(() => overview?.personalRecords ?? [], [overview]);

  const recordsMuscleGroups = useMemo(() => {
    const presentIds = new Set(
      personalRecords.map((record) => record.primaryMuscleGroupId).filter((id) => id > 0),
    );
    return muscleGroups.filter((group) => presentIds.has(group.id));
  }, [muscleGroups, personalRecords]);

  useEffect(() => {
    if (!recordsMuscleGroupId) {
      return;
    }

    const id = Number(recordsMuscleGroupId);
    if (!personalRecords.some((record) => record.primaryMuscleGroupId === id)) {
      setRecordsMuscleGroupId("");
    }
  }, [personalRecords, recordsMuscleGroupId]);

  const filteredPersonalRecords = useMemo(() => {
    if (!recordsMuscleGroupId) {
      return personalRecords;
    }

    const id = Number(recordsMuscleGroupId);
    return personalRecords.filter((record) => record.primaryMuscleGroupId === id);
  }, [personalRecords, recordsMuscleGroupId]);

  const state = useMemo(
    () => ({
      activeTab,
      rangePreset,
      overview,
      isLoadingOverview,
      overviewError,
      volumePoints,
      muscleGroups,
      searchValue,
      muscleGroupFilterId,
      selectedExercise,
      progression,
      isLoadingProgression,
      progressionError,
      progressionPoints,
      personalRecords: filteredPersonalRecords,
      recordsMuscleGroups,
      recordsMuscleGroupId,
    }),
    [
      activeTab,
      rangePreset,
      overview,
      isLoadingOverview,
      overviewError,
      volumePoints,
      muscleGroups,
      searchValue,
      muscleGroupFilterId,
      selectedExercise,
      progression,
      isLoadingProgression,
      progressionError,
      progressionPoints,
      filteredPersonalRecords,
      recordsMuscleGroups,
      recordsMuscleGroupId,
    ],
  );

  const actions = useMemo(
    () => ({
      setRange,
      reloadOverview: () => setReloadIndex((index) => index + 1),
      selectTab,
      search,
      filterByMuscleGroup,
      selectExercise,
      clearExercise,
      filterRecordsByMuscleGroup,
    }),
    [
      setRange,
      selectTab,
      search,
      filterByMuscleGroup,
      selectExercise,
      clearExercise,
      filterRecordsByMuscleGroup,
    ],
  );

  return { state, actions };
}
