import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { todayDateOnlyString } from "@/shared/utils/dateOnly";
import { ProgramPlanStatus } from "@/types";
import type { JsonData, ProgramPlanModel, ProgramProgressModel } from "@/types";

type LifecycleAction = "activate" | "pause" | "complete" | "cancel" | "delete";

export function useProgramDetailPage() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const numericPlanId = Number(planId);

  const [plan, setPlan] = useState<ProgramPlanModel | null>(null);
  const [progress, setProgress] = useState<ProgramProgressModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [isActivateOpen, setIsActivateOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<LifecycleAction | null>(null);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await programPlanService.getById(numericPlanId);
        const loaded = unwrap(response.data, "Unable to load program.");

        let loadedProgress: ProgramProgressModel | null = null;
        if (
          loaded.status === ProgramPlanStatus.Active ||
          loaded.status === ProgramPlanStatus.Paused ||
          loaded.status === ProgramPlanStatus.Completed
        ) {
          const progressResponse = await programPlanService.getProgress(
            loaded.id,
            todayDateOnlyString(),
          );
          loadedProgress = unwrap(progressResponse.data, "Unable to load progress.");
        }

        if (!cancelled) {
          setPlan(loaded);
          setProgress(loadedProgress);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load program.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, [numericPlanId, reloadIndex]);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);

  const runLifecycleAction = useCallback(
    async (
      action: Extract<LifecycleAction, "pause" | "complete" | "cancel">,
      request: () => Promise<{ data: JsonData<boolean> }>,
      successMessage: string,
    ) => {
      if (busyAction !== null) {
        return;
      }

      setBusyAction(action);

      try {
        const response = await request();
        unwrap(response.data, "The action failed.");
        toast.success(successMessage);
        reload();
      } catch (actionError) {
        toast.error(actionError instanceof Error ? actionError.message : "The action failed.");
      } finally {
        setBusyAction(null);
      }
    },
    [busyAction, reload],
  );

  const pause = useCallback(
    () =>
      runLifecycleAction("pause", () => programPlanService.pause(numericPlanId), "Program paused."),
    [numericPlanId, runLifecycleAction],
  );

  const complete = useCallback(
    () =>
      runLifecycleAction(
        "complete",
        () => programPlanService.complete(numericPlanId),
        "Program completed. Nice work!",
      ),
    [numericPlanId, runLifecycleAction],
  );

  const cancel = useCallback(
    () =>
      runLifecycleAction(
        "cancel",
        () => programPlanService.cancel(numericPlanId),
        "Program cancelled.",
      ),
    [numericPlanId, runLifecycleAction],
  );

  const requestActivate = useCallback(() => setIsActivateOpen(true), []);

  const cancelActivate = useCallback(() => {
    if (busyAction === null) {
      setIsActivateOpen(false);
    }
  }, [busyAction]);

  const confirmActivate = useCallback(async () => {
    if (busyAction !== null) {
      return;
    }

    setBusyAction("activate");

    try {
      const response = await programPlanService.activate(numericPlanId);
      unwrap(response.data, "Unable to activate program.");
      toast.success("Program activated.");
      setIsActivateOpen(false);
      reload();
    } catch (activateError) {
      toast.error(
        activateError instanceof Error ? activateError.message : "Unable to activate program.",
      );
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, numericPlanId, reload]);

  const requestDelete = useCallback(() => setIsDeleteConfirmationOpen(true), []);

  const cancelDelete = useCallback(() => {
    if (busyAction === null) {
      setIsDeleteConfirmationOpen(false);
    }
  }, [busyAction]);

  const confirmDelete = useCallback(async () => {
    if (busyAction !== null) {
      return;
    }

    setBusyAction("delete");

    try {
      const response = await programPlanService.remove(numericPlanId);
      unwrap(response.data, "Unable to delete program.");
      toast.success("Draft deleted.");
      navigate("/program");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete program.");
      setBusyAction(null);
    }
  }, [busyAction, navigate, numericPlanId]);

  const edit = useCallback(
    () => navigate(`/program/${numericPlanId}/edit`),
    [navigate, numericPlanId],
  );

  const openCalendar = useCallback(
    () => navigate(`/program/${numericPlanId}/calendar`),
    [navigate, numericPlanId],
  );

  const state = useMemo(
    () => ({
      plan,
      progress,
      isLoading,
      error,
      busyAction,
      isActivateOpen,
      isDeleteConfirmationOpen,
    }),
    [plan, progress, isLoading, error, busyAction, isActivateOpen, isDeleteConfirmationOpen],
  );

  const actions = useMemo(
    () => ({
      reload,
      pause,
      complete,
      cancel,
      requestActivate,
      cancelActivate,
      confirmActivate,
      requestDelete,
      cancelDelete,
      confirmDelete,
      edit,
      openCalendar,
    }),
    [
      reload,
      pause,
      complete,
      cancel,
      requestActivate,
      cancelActivate,
      confirmActivate,
      requestDelete,
      cancelDelete,
      confirmDelete,
      edit,
      openCalendar,
    ],
  );

  return { state, actions };
}
