import { clampNumber, createLocalId } from "@/lib/helpers";
import { diffDaysInclusive, toDateOnlyString } from "@/shared/utils/dateOnly";
import { WEEKDAYS_MONDAY_FIRST } from "@/shared/utils/programDisplay";
import { DayOfWeek, ProgramPlanDayType, ProgramScheduleType, TrainingGoal } from "@/types";
import type {
  CustomProgramDayRequest,
  ProgramPlanDayModel,
  ProgramPlanModel,
  ProgramScheduleRuleRequest,
  SaveProgramPlanRequest,
} from "@/types";

export type WeekdaySlot = {
  dayOfWeek: DayOfWeek;
  templateId: number | null;
  templateName: string | null;
};

export type RotationSlot = {
  localId: string;
  isRest: boolean;
  templateId: number | null;
  templateName: string | null;
};

export type CustomDayEntry = {
  localId: string;
  /** "yyyy-MM-dd" */
  date: string;
  templateId: number | null;
  templateName: string | null;
};

export type ProgramBuilderState = {
  name: string;
  description: string;
  goal: TrainingGoal;
  scheduleType: ProgramScheduleType;
  /** "yyyy-MM-dd" */
  startDate: string;
  /** Open-ended = EndDate null. Forced off for CustomCalendar. */
  isOpenEnded: boolean;
  /** "yyyy-MM-dd"; ignored while isOpenEnded is true. */
  endDate: string;
  /** Always 7 entries, Monday-first. */
  weekdaySlots: WeekdaySlot[];
  rotationSlots: RotationSlot[];
  customDays: CustomDayEntry[];
};

function emptyWeekdaySlots(): WeekdaySlot[] {
  return WEEKDAYS_MONDAY_FIRST.map((dayOfWeek) => ({
    dayOfWeek,
    templateId: null,
    templateName: null,
  }));
}

export function createRotationSlot(isRest: boolean): RotationSlot {
  return { localId: createLocalId("rot"), isRest, templateId: null, templateName: null };
}

export function createCustomDayEntry(date: string): CustomDayEntry {
  return { localId: createLocalId("day"), date, templateId: null, templateName: null };
}

export function createInitialState(): ProgramBuilderState {
  const today = new Date();
  const inFourWeeks = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 27);
  return {
    name: "",
    description: "",
    goal: TrainingGoal.GeneralFitness,
    scheduleType: ProgramScheduleType.FixedWeekdays,
    startDate: toDateOnlyString(today),
    isOpenEnded: false,
    endDate: toDateOnlyString(inFourWeeks),
    weekdaySlots: emptyWeekdaySlots(),
    rotationSlots: [createRotationSlot(false), createRotationSlot(false), createRotationSlot(true)],
    customDays: [],
  };
}

/**
 * Rebuilds editable state from a saved draft. `customDays` comes from the calendar endpoint
 * (ProgramPlanModel carries schedule rules only; custom-calendar drafts persist their days
 * as ProgramPlanDay rows).
 */
export function stateFromPlan(
  plan: ProgramPlanModel,
  customDays: ProgramPlanDayModel[],
): ProgramBuilderState {
  const base = createInitialState();
  const sortedRules = [...plan.scheduleRules].sort(
    (left, right) => left.orderIndex - right.orderIndex,
  );

  return {
    ...base,
    name: plan.name,
    description: plan.description ?? "",
    goal: plan.goal,
    scheduleType: plan.scheduleType,
    startDate: plan.startDate,
    isOpenEnded: plan.endDate == null,
    endDate: plan.endDate ?? base.endDate,
    weekdaySlots:
      plan.scheduleType === ProgramScheduleType.FixedWeekdays
        ? base.weekdaySlots.map((slot) => {
            const rule = sortedRules.find((candidate) => candidate.dayOfWeek === slot.dayOfWeek);
            return rule
              ? {
                  ...slot,
                  templateId: rule.workoutTemplateId ?? null,
                  templateName: rule.workoutTemplateName ?? null,
                }
              : slot;
          })
        : base.weekdaySlots,
    rotationSlots:
      plan.scheduleType === ProgramScheduleType.Rotation
        ? [...sortedRules]
            .sort((left, right) => (left.rotationDayIndex ?? 0) - (right.rotationDayIndex ?? 0))
            .map((rule) => ({
              localId: createLocalId("rot"),
              isRest: rule.dayType === ProgramPlanDayType.Rest,
              templateId: rule.workoutTemplateId ?? null,
              templateName: rule.workoutTemplateName ?? null,
            }))
        : base.rotationSlots,
    customDays:
      plan.scheduleType === ProgramScheduleType.CustomCalendar
        ? customDays.map((day) => ({
            localId: createLocalId("day"),
            date: day.scheduledDate,
            templateId: day.workoutTemplateId ?? null,
            templateName: day.workoutTemplateName ?? null,
          }))
        : base.customDays,
  };
}

/** True when the request will carry an EndDate (CustomCalendar always does). */
export function hasEndDate(state: ProgramBuilderState): boolean {
  return !state.isOpenEnded || state.scheduleType === ProgramScheduleType.CustomCalendar;
}

/** First blocking problem, or null when the state can be submitted ("yyyy-MM-dd" compares lexically). */
export function validateBuilderState(state: ProgramBuilderState): string | null {
  if (!state.name.trim()) {
    return "Give the program a name.";
  }

  if (hasEndDate(state) && state.endDate < state.startDate) {
    return "The end date must be on or after the start date.";
  }

  if (state.scheduleType === ProgramScheduleType.FixedWeekdays) {
    if (state.weekdaySlots.every((slot) => slot.templateId === null)) {
      return "Assign a template to at least one weekday.";
    }
  }

  if (state.scheduleType === ProgramScheduleType.Rotation) {
    if (state.rotationSlots.length === 0) {
      return "Add at least one rotation day.";
    }
    if (!state.rotationSlots.some((slot) => !slot.isRest)) {
      return "A rotation needs at least one workout day.";
    }
    if (state.rotationSlots.some((slot) => !slot.isRest && slot.templateId === null)) {
      return "Every rotation workout day needs a template (or mark it as rest).";
    }
  }

  if (state.scheduleType === ProgramScheduleType.CustomCalendar) {
    if (state.customDays.length === 0) {
      return "Add at least one workout day.";
    }
    if (state.customDays.some((day) => day.templateId === null)) {
      return "Every custom day needs a template.";
    }
    if (state.customDays.some((day) => day.date < state.startDate || day.date > state.endDate)) {
      return "Custom days must fall between the start and end dates.";
    }
  }

  return null;
}

/** Server validates 1–7; derive instead of asking the user. */
export function deriveTargetWorkoutsPerWeek(state: ProgramBuilderState): number {
  if (state.scheduleType === ProgramScheduleType.FixedWeekdays) {
    const assigned = state.weekdaySlots.filter((slot) => slot.templateId !== null).length;
    return clampNumber(assigned, 1, 7);
  }

  if (state.scheduleType === ProgramScheduleType.Rotation) {
    const cycleLength = Math.max(1, state.rotationSlots.length);
    const workouts = state.rotationSlots.filter((slot) => !slot.isRest).length;
    return clampNumber(Math.round((workouts / cycleLength) * 7), 1, 7);
  }

  const totalDays = Math.max(1, diffDaysInclusive(state.startDate, state.endDate));
  const weeks = Math.max(1, totalDays / 7);
  return clampNumber(Math.round(state.customDays.length / weeks), 1, 7);
}

export function buildSaveRequest(state: ProgramBuilderState): SaveProgramPlanRequest {
  const scheduleRules: ProgramScheduleRuleRequest[] = [];

  if (state.scheduleType === ProgramScheduleType.FixedWeekdays) {
    state.weekdaySlots.forEach((slot, index) => {
      if (slot.templateId === null) {
        return;
      }
      scheduleRules.push({
        dayOfWeek: slot.dayOfWeek,
        dayType: ProgramPlanDayType.Workout,
        workoutTemplateId: slot.templateId,
        weekInterval: 1,
        orderIndex: index,
        isOptional: false,
      });
    });
  } else if (state.scheduleType === ProgramScheduleType.Rotation) {
    state.rotationSlots.forEach((slot, index) => {
      scheduleRules.push({
        rotationDayIndex: index + 1,
        dayType: slot.isRest ? ProgramPlanDayType.Rest : ProgramPlanDayType.Workout,
        workoutTemplateId: slot.isRest ? undefined : (slot.templateId ?? undefined),
        weekInterval: 1,
        orderIndex: index,
        isOptional: false,
      });
    });
  }

  const customDays: CustomProgramDayRequest[] =
    state.scheduleType === ProgramScheduleType.CustomCalendar
      ? [...state.customDays]
          .sort((left, right) => left.date.localeCompare(right.date))
          .map((day) => ({
            date: day.date,
            dayType: ProgramPlanDayType.Workout,
            workoutTemplateId: day.templateId ?? undefined,
          }))
      : [];

  return {
    name: state.name.trim(),
    description: state.description.trim() || undefined,
    goal: state.goal,
    scheduleType: state.scheduleType,
    startDate: state.startDate,
    endDate: hasEndDate(state) ? state.endDate : undefined,
    targetWorkoutsPerWeek: deriveTargetWorkoutsPerWeek(state),
    scheduleRules,
    customDays,
  };
}
