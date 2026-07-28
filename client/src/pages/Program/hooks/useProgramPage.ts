import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { todayDateOnlyString } from "@/shared/utils/dateOnly";
import { ProgramPlanStatus } from "@/types";
import type { ProgramPlanModel, ProgramProgressModel, ProgramTodayModel } from "@/types";

export function useProgramPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ProgramPlanModel[] | null>(null);
  const [progress, setProgress] = useState<ProgramProgressModel | null>(null);
  const [todayModel, setTodayModel] = useState<ProgramTodayModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [planPendingDelete, setPlanPendingDelete] = useState<ProgramPlanModel | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrograms() {
      setIsLoading(true);
      setError(null);

      try {
        const localDate = todayDateOnlyString();
        const listResponse = await programPlanService.list();
        const allPlans = unwrap(listResponse.data, "Unable to load programs.");
        const active = allPlans.find((plan) => plan.status === ProgramPlanStatus.Active) ?? null;

        let nextProgress: ProgramProgressModel | null = null;
        let nextToday: ProgramTodayModel | null = null;
        if (active) {
          const [progressResponse, todayResponse] = await Promise.all([
            programPlanService.getProgress(active.id, localDate),
            programPlanService.getToday(localDate),
          ]);
          nextProgress = unwrap(progressResponse.data, "Unable to load progress.");
          nextToday = unwrap(todayResponse.data, "Unable to load today's schedule.");
        }

        if (!cancelled) {
          setPlans(allPlans);
          setProgress(nextProgress);
          setTodayModel(nextToday);
        }
      } catch (loadError) {
        if (!cancelled) {
          setPlans(null);
          setError(loadError instanceof Error ? loadError.message : "Unable to load programs.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPrograms();

    return () => {
      cancelled = true;
    };
  }, [reloadIndex]);

  const activePlan = useMemo(
    () => (plans ?? []).find((plan) => plan.status === ProgramPlanStatus.Active) ?? null,
    [plans],
  );

  const otherPlans = useMemo(
    () => (plans ?? []).filter((plan) => plan.status !== ProgramPlanStatus.Active),
    [plans],
  );

  const open = useCallback((plan: ProgramPlanModel) => navigate(`/program/${plan.id}`), [navigate]);

  const edit = useCallback(
    (plan: ProgramPlanModel) => navigate(`/program/${plan.id}/edit`),
    [navigate],
  );

  const create = useCallback(() => navigate("/program/new"), [navigate]);

  const openCalendar = useCallback(
    (plan: ProgramPlanModel) => navigate(`/program/${plan.id}/calendar`),
    [navigate],
  );

  const requestDelete = useCallback((plan: ProgramPlanModel) => {
    setPlanPendingDelete(plan);
  }, []);

  const cancelDelete = useCallback(() => {
    if (deletingPlanId === null) {
      setPlanPendingDelete(null);
    }
  }, [deletingPlanId]);

  const confirmDelete = useCallback(async () => {
    if (!planPendingDelete || deletingPlanId !== null) {
      return;
    }

    setDeletingPlanId(planPendingDelete.id);

    try {
      const response = await programPlanService.remove(planPendingDelete.id);
      unwrap(response.data, "Unable to delete program.");
      toast.success("Draft deleted.");
      setPlanPendingDelete(null);
      setReloadIndex((index) => index + 1);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete program.");
    } finally {
      setDeletingPlanId(null);
    }
  }, [deletingPlanId, planPendingDelete]);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);

  const state = useMemo(
    () => ({
      isLoading,
      error,
      activePlan,
      otherPlans,
      progress,
      todayModel,
      planPendingDelete,
      deletingPlanId,
    }),
    [
      isLoading,
      error,
      activePlan,
      otherPlans,
      progress,
      todayModel,
      planPendingDelete,
      deletingPlanId,
    ],
  );

  const actions = useMemo(
    () => ({
      open,
      edit,
      create,
      openCalendar,
      requestDelete,
      cancelDelete,
      confirmDelete,
      reload,
    }),
    [open, edit, create, openCalendar, requestDelete, cancelDelete, confirmDelete, reload],
  );

  return { state, actions };
}
