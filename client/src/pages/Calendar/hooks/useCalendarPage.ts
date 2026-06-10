import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { workoutService } from "@/services/workoutService";
import type { WorkoutCalendarDayModel } from "@/types";
import {
  buildMonthMatrix,
  computeCurrentStreak,
  groupWorkoutsByDay,
  isFutureDate,
} from "../utils/calendar";

export function useCalendarPage() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<WorkoutCalendarDayModel[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [userSelectedKey, setUserSelectedKey] = useState<string | null>(null);
  const [isReusing, setIsReusing] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    async function loadCalendar() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await workoutService.getCalendar(year, month);
        setDays(unwrap(response.data, "Unable to load calendar."));
      } catch (loadError) {
        setDays(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load calendar.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadCalendar();
  }, [year, month, reloadIndex]);

  useEffect(() => {
    let cancelled = false;

    async function loadStreak() {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;

      try {
        const [currentResponse, previousResponse] = await Promise.all([
          workoutService.getCalendar(currentYear, currentMonth),
          workoutService.getCalendar(previousYear, previousMonth),
        ]);
        if (cancelled) {
          return;
        }

        const recentDays = [
          ...unwrap(currentResponse.data, "Unable to load streak."),
          ...unwrap(previousResponse.data, "Unable to load streak."),
        ];
        setStreak(computeCurrentStreak(recentDays));
      } catch {
        if (!cancelled) {
          setStreak(0);
        }
      }
    }

    void loadStreak();

    return () => {
      cancelled = true;
    };
  }, [reloadIndex]);

  useEffect(() => {
    setUserSelectedKey(null);
  }, [year, month]);

  const cells = useMemo(() => buildMonthMatrix(year, month), [year, month]);
  const workoutsByDay = useMemo(() => groupWorkoutsByDay(days ?? []), [days]);

  const defaultSelectedKey = useMemo(() => {
    const selectable = cells.filter((cell) => cell.isCurrentMonth && !isFutureDate(cell.date));
    if (selectable.length === 0) {
      return null;
    }

    const today = selectable.find((cell) => cell.isToday);
    if (today) {
      return today.dayKey;
    }

    const firstWithWorkout = selectable.find((cell) => (workoutsByDay.get(cell.dayKey)?.length ?? 0) > 0);
    return (firstWithWorkout ?? selectable[0]).dayKey;
  }, [cells, workoutsByDay]);

  const selectedKey = userSelectedKey ?? defaultSelectedKey;
  const selectedCell = useMemo(
    () => cells.find((cell) => cell.isCurrentMonth && cell.dayKey === selectedKey) ?? null,
    [cells, selectedKey],
  );
  const selectedWorkouts = useMemo(
    () => (selectedKey ? (workoutsByDay.get(selectedKey) ?? []) : []),
    [workoutsByDay, selectedKey],
  );

  const prevMonth = useCallback(() => {
    setMonth((current) => {
      if (current === 1) {
        setYear((value) => value - 1);
        return 12;
      }

      return current - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setMonth((current) => {
      if (current === 12) {
        setYear((value) => value + 1);
        return 1;
      }

      return current + 1;
    });
  }, []);

  const setMonthYear = useCallback((nextYear: number, nextMonth: number) => {
    setYear(nextYear);
    setMonth(nextMonth);
    setIsPickerOpen(false);
  }, []);

  const goToday = useCallback(() => {
    const today = new Date();
    setUserSelectedKey(null);
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }, []);

  const selectDay = useCallback((dayKey: string) => {
    setUserSelectedKey(dayKey);
  }, []);

  const openPicker = useCallback(() => setIsPickerOpen(true), []);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  const reuse = useCallback(
    async (workout: WorkoutCalendarDayModel) => {
      if (isReusing) {
        return;
      }

      setIsReusing(true);

      try {
        const response = await workoutService.duplicate(workout.workoutId);
        const duplicateId = unwrap(response.data, "Unable to duplicate workout.");
        navigate(`/workouts/${duplicateId}`);
      } catch (reuseError) {
        toast.error(reuseError instanceof Error ? reuseError.message : "Unable to duplicate workout.");
        setIsReusing(false);
      }
    },
    [isReusing, navigate],
  );

  const state = useMemo(
    () => ({
      year,
      month,
      cells,
      workoutsByDay,
      workoutCount: days?.length ?? 0,
      streak,
      isLoading,
      error,
      selectedKey,
      selectedCell,
      selectedWorkouts,
      isReusing,
      isPickerOpen,
    }),
    [
      year,
      month,
      cells,
      workoutsByDay,
      days,
      streak,
      isLoading,
      error,
      selectedKey,
      selectedCell,
      selectedWorkouts,
      isReusing,
      isPickerOpen,
    ],
  );

  const actions = useMemo(
    () => ({
      prevMonth,
      nextMonth,
      setMonthYear,
      goToday,
      selectDay,
      reuse,
      openPicker,
      closePicker,
      reload: () => setReloadIndex((index) => index + 1),
    }),
    [prevMonth, nextMonth, setMonthYear, goToday, selectDay, reuse, openPicker, closePicker],
  );

  return { state, actions };
}
