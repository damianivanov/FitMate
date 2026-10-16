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
import type {
  AnalyticsExerciseSelection,
  AnalyticsRangePreset,
  AnalyticsTab,
  ProgressionMetric,
} from "../types";
import { getProgressionChange, toProgressionPoints, toVolumePoints } from "../utils/analyticsFormat";

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

  const [activeTab, setActiveTab] = useState<AnalyticsTab>("exercise");

  const [searchValue, setSearchValue] = useState("");
  const [muscleGroupFilterId, setMuscleGroupFilterId] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<AnalyticsExerciseSelection | null>(null);
  const [progressionMetric, setProgressionMetric] = useState<ProgressionMetric>("oneRepMax");

  const [recordsMuscleGroupId, setRecordsMuscleGroupId] = useState("");

  const { muscleGroups } = useMuscleGroups();

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadOverview() {
      setIsLoadingOverview(true);
      setOverviewError(null);

      try {
        const response = await analyticsService.getOverview(range);
        const nextOverview = unwrap(response.data, "Unable to load analytics.");
        if (!isCancelled) {
          setOverview(nextOverview);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setOverviewError(loadError instanceof Error ? loadError.message : "Unable to load analytics.");
          setOverview(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingOverview(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isCancelled = true;
    };
  }, [range, reloadIndex]);

  const [progression, setProgression] = useState<ExerciseProgression | null>(null);
  const [isLoadingProgression, setIsLoadingProgression] = useState(false);
  const [progressionError, setProgressionError] = useState<string | null>(null);
  const [progressionReloadIndex, setProgressionReloadIndex] = useState(0);
  const selectedExerciseId = selectedExercise?.id ?? null;

  useEffect(() => {
    let isCancelled = false;

    async function loadProgression() {
      if (selectedExerciseId == null) {
        setProgression(null);
        setProgressionError(null);
        setIsLoadingProgression(false);
        return;
      }

      setIsLoadingProgression(true);
      setProgressionError(null);

      try {
        const response = await analyticsService.getExerciseProgression(selectedExerciseId, range);
        const nextProgression = unwrap(response.data, "Unable to load progression.");
        if (!isCancelled) {
          setProgression(nextProgression);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setProgressionError(loadError instanceof Error ? loadError.message : "Unable to load progression.");
          setProgression(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProgression(false);
        }
      }
    }

    void loadProgression();

    return () => {
      isCancelled = true;
    };
  }, [selectedExerciseId, range, progressionReloadIndex]);

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
    setSelectedExercise({
      id: exercise.id,
      name: exercise.name,
      muscleGroupName: exercise.primaryMuscleGroupName,
      imageUrl: exercise.imageUrl,
    });
  }, []);

  const openExercise = useCallback((exercise: AnalyticsExerciseSelection) => {
    setSelectedExercise(exercise);
    setActiveTab("exercise");
  }, []);

  const clearExercise = useCallback(() => {
    setSelectedExercise(null);
    setSearchValue("");
  }, []);

  const selectTab = useCallback((tab: AnalyticsTab) => {
    setActiveTab(tab);
  }, []);

  const selectProgressionMetric = useCallback((metric: ProgressionMetric) => {
    setProgressionMetric(metric);
  }, []);

  const filterRecordsByMuscleGroup = useCallback((value: string) => {
    setRecordsMuscleGroupId(value);
  }, []);

  const volumePoints = useMemo(() => toVolumePoints(overview), [overview]);
  const progressionPoints = useMemo(
    () => toProgressionPoints(progression, progressionMetric),
    [progression, progressionMetric],
  );
  const progressionChange = useMemo(
    () => getProgressionChange(progression, progressionMetric),
    [progression, progressionMetric],
  );

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
      progressionMetric,
      progressionPoints,
      progressionChange,
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
      progressionMetric,
      progressionPoints,
      progressionChange,
      filteredPersonalRecords,
      recordsMuscleGroups,
      recordsMuscleGroupId,
    ],
  );

  const actions = useMemo(
    () => ({
      setRange,
      reloadOverview: () => setReloadIndex((index) => index + 1),
      reloadProgression: () => setProgressionReloadIndex((index) => index + 1),
      selectTab,
      search,
      filterByMuscleGroup,
      selectExercise,
      openExercise,
      clearExercise,
      selectProgressionMetric,
      filterRecordsByMuscleGroup,
    }),
    [
      setRange,
      selectTab,
      search,
      filterByMuscleGroup,
      selectExercise,
      openExercise,
      clearExercise,
      selectProgressionMetric,
      filterRecordsByMuscleGroup,
    ],
  );

  return { state, actions };
}
