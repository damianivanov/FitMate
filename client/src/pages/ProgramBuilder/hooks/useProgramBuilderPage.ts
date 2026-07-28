import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { parseDateOnly } from "@/shared/utils/dateOnly";
import { ProgramPlanStatus, ProgramScheduleType, TrainingGoal } from "@/types";
import type {
  DayOfWeek,
  ProgramPlanDayModel,
  ProgramPlanModel,
  WorkoutTemplateModel,
} from "@/types";
import {
  buildSaveRequest,
  createCustomDayEntry,
  createInitialState,
  createRotationSlot,
  stateFromPlan,
  validateBuilderState,
  type ProgramBuilderState,
} from "../utils/builderState";

export type PickerTarget =
  | { kind: "weekday"; dayOfWeek: DayOfWeek }
  | { kind: "rotation"; localId: string }
  | { kind: "custom"; localId: string };

/**
 * ProgramPlanModel carries schedule rules only; a custom-calendar draft persists its days as
 * ProgramPlanDay rows, so they are read back month by month from the calendar endpoint.
 */
async function loadCustomDays(plan: ProgramPlanModel): Promise<ProgramPlanDayModel[]> {
  const start = parseDateOnly(plan.startDate);
  const end = parseDateOnly(plan.endDate ?? plan.startDate);
  const requests = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    requests.push(
      programPlanService.getCalendar(plan.id, cursor.getFullYear(), cursor.getMonth() + 1),
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const responses = await Promise.all(requests);
  return responses.flatMap((response) => unwrap(response.data, "Unable to load program days."));
}

export function useProgramBuilderPage() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const editingPlanId = planId ? Number(planId) : null;

  const [builderState, setBuilderState] = useState<ProgramBuilderState>(createInitialState);
  const [isLoading, setIsLoading] = useState(editingPlanId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [planPendingActivation, setPlanPendingActivation] = useState<ProgramPlanModel | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    if (editingPlanId === null) {
      return;
    }

    let cancelled = false;

    async function loadDraft(id: number) {
      try {
        const response = await programPlanService.getById(id);
        const plan = unwrap(response.data, "Unable to load program.");

        if (plan.status !== ProgramPlanStatus.Draft) {
          toast.error("Only draft programs can be edited.");
          navigate(`/program/${plan.id}`, { replace: true });
          return;
        }

        const customDays =
          plan.scheduleType === ProgramScheduleType.CustomCalendar ? await loadCustomDays(plan) : [];

        if (!cancelled) {
          setBuilderState(stateFromPlan(plan, customDays));
        }
      } catch (loadDraftError) {
        if (!cancelled) {
          setLoadError(
            loadDraftError instanceof Error ? loadDraftError.message : "Unable to load program.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDraft(editingPlanId);

    return () => {
      cancelled = true;
    };
  }, [editingPlanId, navigate]);

  const patch = useCallback((partial: Partial<ProgramBuilderState>) => {
    setBuilderState((current) => ({ ...current, ...partial }));
  }, []);

  const setName = useCallback((name: string) => patch({ name }), [patch]);
  const setDescription = useCallback((description: string) => patch({ description }), [patch]);
  const setGoal = useCallback((goal: TrainingGoal) => patch({ goal }), [patch]);
  const setStartDate = useCallback((startDate: string) => patch({ startDate }), [patch]);
  const setEndDate = useCallback((endDate: string) => patch({ endDate }), [patch]);

  const setScheduleType = useCallback(
    (scheduleType: ProgramScheduleType) =>
      setBuilderState((current) => ({
        ...current,
        scheduleType,
        // CustomCalendar requires an end date.
        isOpenEnded:
          scheduleType === ProgramScheduleType.CustomCalendar ? false : current.isOpenEnded,
      })),
    [],
  );

  const setOpenEnded = useCallback((isOpenEnded: boolean) => patch({ isOpenEnded }), [patch]);

  const openPicker = useCallback((target: PickerTarget) => setPickerTarget(target), []);
  const closePicker = useCallback(() => setPickerTarget(null), []);

  const assignTemplate = useCallback(
    (template: WorkoutTemplateModel) => {
      setBuilderState((current) => {
        if (!pickerTarget) {
          return current;
        }

        if (pickerTarget.kind === "weekday") {
          return {
            ...current,
            weekdaySlots: current.weekdaySlots.map((slot) =>
              slot.dayOfWeek === pickerTarget.dayOfWeek
                ? { ...slot, templateId: template.id, templateName: template.name }
                : slot,
            ),
          };
        }

        if (pickerTarget.kind === "rotation") {
          return {
            ...current,
            rotationSlots: current.rotationSlots.map((slot) =>
              slot.localId === pickerTarget.localId
                ? { ...slot, isRest: false, templateId: template.id, templateName: template.name }
                : slot,
            ),
          };
        }

        return {
          ...current,
          customDays: current.customDays.map((day) =>
            day.localId === pickerTarget.localId
              ? { ...day, templateId: template.id, templateName: template.name }
              : day,
          ),
        };
      });
      setPickerTarget(null);
    },
    [pickerTarget],
  );

  const clearWeekday = useCallback((dayOfWeek: DayOfWeek) => {
    setBuilderState((current) => ({
      ...current,
      weekdaySlots: current.weekdaySlots.map((slot) =>
        slot.dayOfWeek === dayOfWeek ? { ...slot, templateId: null, templateName: null } : slot,
      ),
    }));
  }, []);

  const addRotationDay = useCallback(() => {
    setBuilderState((current) => ({
      ...current,
      rotationSlots: [...current.rotationSlots, createRotationSlot(true)],
    }));
  }, []);

  const removeRotationDay = useCallback((localId: string) => {
    setBuilderState((current) => ({
      ...current,
      rotationSlots: current.rotationSlots.filter((slot) => slot.localId !== localId),
    }));
  }, []);

  const setRotationRest = useCallback((localId: string) => {
    setBuilderState((current) => ({
      ...current,
      rotationSlots: current.rotationSlots.map((slot) =>
        slot.localId === localId
          ? { ...slot, isRest: true, templateId: null, templateName: null }
          : slot,
      ),
    }));
  }, []);

  const addCustomDay = useCallback(() => {
    setBuilderState((current) => ({
      ...current,
      customDays: [...current.customDays, createCustomDayEntry(current.startDate)],
    }));
  }, []);

  const removeCustomDay = useCallback((localId: string) => {
    setBuilderState((current) => ({
      ...current,
      customDays: current.customDays.filter((day) => day.localId !== localId),
    }));
  }, []);

  const setCustomDayDate = useCallback((localId: string, date: string) => {
    setBuilderState((current) => ({
      ...current,
      customDays: current.customDays.map((day) =>
        day.localId === localId ? { ...day, date } : day,
      ),
    }));
  }, []);

  const saveDraftInternal = useCallback(async (): Promise<ProgramPlanModel | null> => {
    const validationError = validateBuilderState(builderState);
    if (validationError) {
      toast.error(validationError);
      return null;
    }

    setIsSaving(true);

    try {
      const payload = buildSaveRequest(builderState);
      const response =
        editingPlanId === null
          ? await programPlanService.create(payload)
          : await programPlanService.update(editingPlanId, payload);
      return unwrap(response.data, "Unable to save program.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Unable to save program.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [builderState, editingPlanId]);

  const saveDraft = useCallback(async () => {
    const saved = await saveDraftInternal();
    if (saved) {
      toast.success("Draft saved.");
      navigate(`/program/${saved.id}`);
    }
  }, [navigate, saveDraftInternal]);

  /** Save (create or update) the draft first, then open the confirmation card. */
  const requestActivate = useCallback(async () => {
    const saved = await saveDraftInternal();
    if (saved) {
      setPlanPendingActivation(saved);
    }
  }, [saveDraftInternal]);

  const cancelActivate = useCallback(() => {
    if (!isActivating && planPendingActivation) {
      // Draft is already saved — leave the user on its detail page.
      navigate(`/program/${planPendingActivation.id}`);
    }
  }, [isActivating, navigate, planPendingActivation]);

  const confirmActivate = useCallback(async () => {
    if (!planPendingActivation || isActivating) {
      return;
    }

    setIsActivating(true);

    try {
      const response = await programPlanService.activate(planPendingActivation.id);
      unwrap(response.data, "Unable to activate program.");
      toast.success("Program activated.");
      navigate("/program");
    } catch (activateError) {
      toast.error(
        activateError instanceof Error ? activateError.message : "Unable to activate program.",
      );
      setIsActivating(false);
    }
  }, [isActivating, navigate, planPendingActivation]);

  const state = useMemo(
    () => ({
      builderState,
      isLoading,
      loadError,
      isEditing: editingPlanId !== null,
      isSaving,
      isPickerOpen: pickerTarget !== null,
      planPendingActivation,
      isActivating,
      customDayCount: builderState.customDays.length,
    }),
    [
      builderState,
      editingPlanId,
      isLoading,
      loadError,
      isSaving,
      pickerTarget,
      planPendingActivation,
      isActivating,
    ],
  );

  const actions = useMemo(
    () => ({
      setName,
      setDescription,
      setGoal,
      setScheduleType,
      setStartDate,
      setEndDate,
      setOpenEnded,
      openPicker,
      closePicker,
      assignTemplate,
      clearWeekday,
      addRotationDay,
      removeRotationDay,
      setRotationRest,
      addCustomDay,
      removeCustomDay,
      setCustomDayDate,
      saveDraft,
      requestActivate,
      cancelActivate,
      confirmActivate,
    }),
    [
      setName,
      setDescription,
      setGoal,
      setScheduleType,
      setStartDate,
      setEndDate,
      setOpenEnded,
      openPicker,
      closePicker,
      assignTemplate,
      clearWeekday,
      addRotationDay,
      removeRotationDay,
      setRotationRest,
      addCustomDay,
      removeCustomDay,
      setCustomDayDate,
      saveDraft,
      requestActivate,
      cancelActivate,
      confirmActivate,
    ],
  );

  return { state, actions };
}
