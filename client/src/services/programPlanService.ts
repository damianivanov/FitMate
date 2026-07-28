import api from "@/lib/api";
import type {
  JsonData,
  MoveProgramDayRequest,
  ProgramPlanDayModel,
  ProgramPlanModel,
  ProgramProgressModel,
  ProgramTodayModel,
  SaveProgramPlanRequest,
} from "@/types";

export const programPlanService = {
  async list() {
    return api.get<JsonData<ProgramPlanModel[]>>("program-plans");
  },

  async getById(id: number) {
    return api.get<JsonData<ProgramPlanModel>>(`program-plans/${id}`);
  },

  async getActive() {
    return api.get<JsonData<ProgramPlanModel>>("program-plans/active");
  },

  /** `localDate` must be the client's local "yyyy-MM-dd" (todayDateOnlyString()). */
  async getToday(localDate: string) {
    return api.get<JsonData<ProgramTodayModel>>("program-plans/active/today", {
      params: { date: localDate },
    });
  },

  async getCalendar(id: number, year: number, month: number) {
    return api.get<JsonData<ProgramPlanDayModel[]>>(`program-plans/${id}/calendar`, {
      params: { year, month },
    });
  },

  async getProgress(id: number, localDate: string) {
    return api.get<JsonData<ProgramProgressModel>>(`program-plans/${id}/progress`, {
      params: { date: localDate },
    });
  },

  async create(payload: SaveProgramPlanRequest) {
    return api.post<JsonData<ProgramPlanModel>>("program-plans", payload);
  },

  async update(id: number, payload: SaveProgramPlanRequest) {
    return api.put<JsonData<ProgramPlanModel>>(`program-plans/${id}`, payload);
  },

  async activate(id: number) {
    return api.post<JsonData<ProgramPlanModel>>(`program-plans/${id}/activate`);
  },

  async pause(id: number) {
    return api.post<JsonData<boolean>>(`program-plans/${id}/pause`);
  },

  async complete(id: number) {
    return api.post<JsonData<boolean>>(`program-plans/${id}/complete`);
  },

  async cancel(id: number) {
    return api.post<JsonData<boolean>>(`program-plans/${id}/cancel`);
  },

  async remove(id: number) {
    return api.delete<JsonData<boolean>>(`program-plans/${id}`);
  },

  /** Returns the started (or already-started — idempotent) workout id. */
  async startDay(dayId: number) {
    return api.post<JsonData<number>>(`program-plan-days/${dayId}/start`);
  },

  async moveDay(dayId: number, payload: MoveProgramDayRequest) {
    return api.post<JsonData<ProgramPlanDayModel>>(`program-plan-days/${dayId}/move`, payload);
  },

  async skipDay(dayId: number) {
    return api.post<JsonData<ProgramPlanDayModel>>(`program-plan-days/${dayId}/skip`);
  },

  async restoreDay(dayId: number) {
    return api.post<JsonData<ProgramPlanDayModel>>(`program-plan-days/${dayId}/restore`);
  },
};
