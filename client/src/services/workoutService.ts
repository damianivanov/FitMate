import api from "@/lib/api";
import type {
  ActiveWorkoutModel,
  ExerciseHistoryResponse,
  JsonData,
  SaveWorkoutRequest,
  WorkoutCalendarDayModel,
  WorkoutCreatedModel,
  WorkoutModel,
} from "@/types";

export const workoutService = {
  async list() {
    return api.get<JsonData<WorkoutModel[]>>("workouts");
  },

  async getById(id: number) {
    return api.get<JsonData<WorkoutModel>>(`workouts/${id}`);
  },

  /** The session already running, or null. Data is null when nothing is in progress. */
  async getActive() {
    return api.get<JsonData<ActiveWorkoutModel | null>>("workouts/active");
  },

  async getCalendar(year: number, month: number) {
    return api.get<JsonData<WorkoutCalendarDayModel[]>>("workouts/calendar", {
      params: { year, month },
    });
  },

  async startFromTemplate(templateId: number) {
    return api.post<JsonData<number>>(`workouts/start-from-template/${templateId}`);
  },

  async duplicate(id: number) {
    return api.post<JsonData<number>>(`workouts/duplicate/${id}`);
  },

  async create(payload: SaveWorkoutRequest) {
    return api.post<JsonData<WorkoutCreatedModel>>("workouts", payload);
  },

  async update(id: number, payload: SaveWorkoutRequest) {
    return api.put<JsonData<WorkoutCreatedModel>>(`workouts/${id}`, payload);
  },

  async finish(id: number, payload: SaveWorkoutRequest) {
    return api.post<JsonData<WorkoutCreatedModel>>(`workouts/${id}/finish`, payload);
  },

  async remove(id: number) {
    return api.delete<JsonData<boolean>>(`workouts/${id}`);
  },

  async getExerciseHistory(exerciseIds: number[], take = 3) {
    const params = new URLSearchParams();
    exerciseIds.forEach((id) => {
      params.append("exerciseIds", String(id));
    });
    params.append("take", String(take));

    return api.get<JsonData<ExerciseHistoryResponse>>("workouts/exercise-history", { params });
  },
};
