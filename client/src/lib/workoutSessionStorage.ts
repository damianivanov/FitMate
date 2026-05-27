import { clearStoredObject, loadStoredObject, saveStoredObject } from "@/lib/localStorage";

type WorkoutSessionStartedAtStorage = {
  startedAtUtc: string;
  workoutId?: number;
};

const WORKOUT_SESSION_STARTED_AT_STORAGE_VERSION = 1;
const WORKOUT_SESSION_STARTED_AT_MAX_AGE_MS = 18 * 60 * 60 * 1000;

function getWorkoutSessionStartedAtStorageKey(templateId: number): string {
  return `fitmate.workouts.template.${templateId}.startedAt`;
}

function getStandaloneWorkoutSessionStartedAtStorageKey(): string {
  return "fitmate.workouts.standalone.startedAt";
}

function isValidStartedAtValue(value: string): boolean {
  const startedAtMs = new Date(value).getTime();
  return Number.isFinite(startedAtMs) && startedAtMs <= Date.now();
}

function isWorkoutSessionStartedAtStorage(
  value: unknown,
): value is WorkoutSessionStartedAtStorage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WorkoutSessionStartedAtStorage>;
  return (
    typeof candidate.startedAtUtc === "string"
    && isValidStartedAtValue(candidate.startedAtUtc)
    && (
      candidate.workoutId === undefined
      || (typeof candidate.workoutId === "number" && candidate.workoutId > 0)
    )
  );
}

function getWorkoutSessionState(storageKey: string): { startedAt: Date; workoutId?: number } {
  const storedSession = loadStoredObject<WorkoutSessionStartedAtStorage>(storageKey, {
    version: WORKOUT_SESSION_STARTED_AT_STORAGE_VERSION,
    validate: isWorkoutSessionStartedAtStorage,
  });

  if (storedSession) {
    const startedAtDate = new Date(storedSession.startedAtUtc);
    const startedAtAgeMs = Date.now() - startedAtDate.getTime();
    if (startedAtAgeMs <= WORKOUT_SESSION_STARTED_AT_MAX_AGE_MS) {
      return {
        startedAt: startedAtDate,
        workoutId: storedSession.workoutId,
      };
    }

    clearStoredObject(storageKey);
  }

  const startedAtDate = new Date();
  saveStoredObject(
    storageKey,
    { startedAtUtc: startedAtDate.toISOString() },
    WORKOUT_SESSION_STARTED_AT_STORAGE_VERSION,
  );
  return { startedAt: startedAtDate };
}

function clearWorkoutSessionStorageIfMatches(storageKey: string, workoutId: number): void {
  const storedSession = loadStoredObject<WorkoutSessionStartedAtStorage>(storageKey, {
    version: WORKOUT_SESSION_STARTED_AT_STORAGE_VERSION,
    validate: isWorkoutSessionStartedAtStorage,
  });

  if (storedSession?.workoutId === workoutId) {
    clearStoredObject(storageKey);
  }
}

export function getTemplateWorkoutSessionState(templateId: number): { startedAt: Date; workoutId?: number } {
  return getWorkoutSessionState(getWorkoutSessionStartedAtStorageKey(templateId));
}

export function getStandaloneWorkoutSessionState(): { startedAt: Date; workoutId?: number } {
  return getWorkoutSessionState(getStandaloneWorkoutSessionStartedAtStorageKey());
}

export function saveWorkoutSessionState(
  workoutTemplateId: number | null | undefined,
  startedAtUtc: string,
  workoutId: number,
): void {
  saveStoredObject(
    workoutTemplateId
      ? getWorkoutSessionStartedAtStorageKey(workoutTemplateId)
      : getStandaloneWorkoutSessionStartedAtStorageKey(),
    { startedAtUtc, workoutId },
    WORKOUT_SESSION_STARTED_AT_STORAGE_VERSION,
  );
}

export function clearWorkoutSessionState(workoutTemplateId: number | null | undefined): void {
  clearStoredObject(
    workoutTemplateId
      ? getWorkoutSessionStartedAtStorageKey(workoutTemplateId)
      : getStandaloneWorkoutSessionStartedAtStorageKey(),
  );
}

export function clearDeletedWorkoutSessionState(
  workoutId: number,
  workoutTemplateId: number | null | undefined,
): void {
  clearWorkoutSessionStorageIfMatches(getStandaloneWorkoutSessionStartedAtStorageKey(), workoutId);

  if (workoutTemplateId) {
    clearWorkoutSessionStorageIfMatches(getWorkoutSessionStartedAtStorageKey(workoutTemplateId), workoutId);
  }
}
