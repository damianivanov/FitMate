import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { useStartProgramDay } from "@/shared/hooks/useStartProgramDay";
import { parseDateOnly, todayDateOnlyString } from "@/shared/utils/dateOnly";
import { buildMonthMatrix, toDayKey } from "@/shared/utils/monthGrid";
import type { JsonData, ProgramPlanDayModel, ProgramPlanModel } from "@/types";

export function useProgramCalendarPage() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const numericPlanId = Number(planId);
  const now = useMemo(() => new Date(), []);

  const [plan, setPlan] = useState<ProgramPlanModel | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<ProgramPlanDayModel[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [userSelectedKey, setUserSelectedKey] = useState<string | null>(null);
  const [dayPendingMove, setDayPendingMove] = useState<ProgramPlanDayModel | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [busyDayId, setBusyDayId] = useState<number | null>(null);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);
  const { startingDayId, startProgramDay } = useStartProgramDay(reload);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      setIsLoading(true);
      setError(null);

      try {
        const [planResponse, daysResponse] = await Promise.all([
          programPlanService.getById(numericPlanId),
          programPlanService.getCalendar(numericPlanId, year, month),
        ]);

        if (!cancelled) {
          setPlan(unwrap(planResponse.data, "Unable to load program."));
          setDays(unwrap(daysResponse.data, "Unable to load calendar."));
        }
      } catch (loadError) {
        if (!cancelled) {
          setDays(null);
          setError(loadError instanceof Error ? loadError.message : "Unable to load calendar.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCalendar();

    return () => {
      cancelled = true;
    };
  }, [numericPlanId, year, month, reloadIndex]);

  useEffect(() => {
    setUserSelectedKey(null);
  }, [year, month]);

  const cells = useMemo(() => buildMonthMatrix(year, month), [year, month]);

  const daysByKey = useMemo(() => {
    const grouped = new Map<string, ProgramPlanDayModel[]>();
    for (const day of days ?? []) {
      const key = toDayKey(parseDateOnly(day.scheduledDate));
      const existing = grouped.get(key);
      if (existing) {
        existing.push(day);
      } else {
        grouped.set(key, [day]);
      }
    }
    return grouped;
  }, [days]);

  const defaultSelectedKey = useMemo(() => {
    const today = cells.find((cell) => cell.isCurrentMonth && cell.isToday);
    if (today) {
      return today.dayKey;
    }

    const firstWithDay = cells.find(
      (cell) => cell.isCurrentMonth && (daysByKey.get(cell.dayKey)?.length ?? 0) > 0,
    );
    return firstWithDay?.dayKey ?? null;
  }, [cells, daysByKey]);

  const selectedKey = userSelectedKey ?? defaultSelectedKey;

  const selectedCell = useMemo(
    () => cells.find((cell) => cell.isCurrentMonth && cell.dayKey === selectedKey) ?? null,
    [cells, selectedKey],
  );

  const selectedDays = useMemo(
    () => (selectedKey ? (daysByKey.get(selectedKey) ?? []) : []),
    [daysByKey, selectedKey],
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

  const goToday = useCallback(() => {
    const today = new Date();
    setUserSelectedKey(null);
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }, []);

  const selectDay = useCallback((dayKey: string) => setUserSelectedKey(dayKey), []);

  const runDayAction = useCallback(
    async (
      day: ProgramPlanDayModel,
      request: () => Promise<{ data: JsonData<ProgramPlanDayModel> }>,
      successMessage: string,
    ) => {
      if (busyDayId !== null) {
        return;
      }

      setBusyDayId(day.id);

      try {
        const response = await request();
        unwrap(response.data, "The action failed.");
        toast.success(successMessage);
        reload();
      } catch (actionError) {
        toast.error(actionError instanceof Error ? actionError.message : "The action failed.");
      } finally {
        setBusyDayId(null);
      }
    },
    [busyDayId, reload],
  );

  const skip = useCallback(
    (day: ProgramPlanDayModel) =>
      runDayAction(day, () => programPlanService.skipDay(day.id), "Workout skipped."),
    [runDayAction],
  );

  const restore = useCallback(
    (day: ProgramPlanDayModel) =>
      runDayAction(day, () => programPlanService.restoreDay(day.id), "Workout restored."),
    [runDayAction],
  );

  const requestMove = useCallback((day: ProgramPlanDayModel) => setDayPendingMove(day), []);

  const cancelMove = useCallback(() => {
    if (!isMoving) {
      setDayPendingMove(null);
    }
  }, [isMoving]);

  const confirmMove = useCallback(
    async (newDate: string) => {
      if (!dayPendingMove || isMoving) {
        return;
      }

      setIsMoving(true);

      try {
        const response = await programPlanService.moveDay(dayPendingMove.id, { newDate });
        unwrap(response.data, "Unable to move workout.");
        toast.success("Workout moved.");
        setDayPendingMove(null);
        reload();
      } catch (moveError) {
        toast.error(moveError instanceof Error ? moveError.message : "Unable to move workout.");
      } finally {
        setIsMoving(false);
      }
    },
    [dayPendingMove, isMoving, reload],
  );

  const openWorkout = useCallback(
    (day: ProgramPlanDayModel) => {
      if (day.completedWorkoutId) {
        navigate(`/workouts/${day.completedWorkoutId}/summary`);
      } else if (day.startedWorkoutId) {
        navigate(`/workouts/${day.startedWorkoutId}`);
      }
    },
    [navigate],
  );

  const state = useMemo(
    () => ({
      plan,
      year,
      month,
      cells,
      daysByKey,
      selectedKey,
      selectedCell,
      selectedDays,
      isLoading,
      error,
      dayPendingMove,
      isMoving,
      busyDayId,
      startingDayId,
      todayString: todayDateOnlyString(),
    }),
    [
      plan,
      year,
      month,
      cells,
      daysByKey,
      selectedKey,
      selectedCell,
      selectedDays,
      isLoading,
      error,
      dayPendingMove,
      isMoving,
      busyDayId,
      startingDayId,
    ],
  );

  const actions = useMemo(
    () => ({
      prevMonth,
      nextMonth,
      goToday,
      selectDay,
      reload,
      start: startProgramDay,
      skip,
      restore,
      requestMove,
      cancelMove,
      confirmMove,
      openWorkout,
    }),
    [
      prevMonth,
      nextMonth,
      goToday,
      selectDay,
      reload,
      startProgramDay,
      skip,
      restore,
      requestMove,
      cancelMove,
      confirmMove,
      openWorkout,
    ],
  );

  return { state, actions };
}
