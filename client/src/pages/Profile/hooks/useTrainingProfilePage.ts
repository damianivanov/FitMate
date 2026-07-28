import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { unwrap } from "@/lib/unwrap";
import { trainingProfileService } from "@/services/trainingProfileService";
import {
  DayOfWeek,
  TrainingExperienceLevel,
  TrainingGoal,
  WeightUnit,
  type SaveTrainingProfileRequest,
  type TrainingProfileModel,
} from "@/types";

export type TrainingProfileFormValues = {
  goal: TrainingGoal;
  experienceLevel: TrainingExperienceLevel;
  preferredTrainingDaysPerWeek: number;
  preferredWorkoutDurationMinutes: string;
  weightUnit: WeightUnit;
  availableEquipment: string[];
  preferredTrainingDays: DayOfWeek[];
  exerciseRestrictions: string;
  additionalPreferences: string;
  allowAiPersonalization: boolean;
};

const defaultFormValues: TrainingProfileFormValues = {
  goal: TrainingGoal.GeneralFitness,
  experienceLevel: TrainingExperienceLevel.Beginner,
  preferredTrainingDaysPerWeek: 3,
  preferredWorkoutDurationMinutes: "",
  weightUnit: WeightUnit.Kg,
  availableEquipment: [],
  preferredTrainingDays: [],
  exerciseRestrictions: "",
  additionalPreferences: "",
  allowAiPersonalization: true,
};

function toFormValues(model: TrainingProfileModel): TrainingProfileFormValues {
  return {
    goal: model.goal,
    experienceLevel: model.experienceLevel,
    preferredTrainingDaysPerWeek: model.preferredTrainingDaysPerWeek,
    preferredWorkoutDurationMinutes:
      model.preferredWorkoutDurationMinutes != null
        ? String(model.preferredWorkoutDurationMinutes)
        : "",
    weightUnit: model.weightUnit,
    availableEquipment: model.availableEquipment ?? [],
    preferredTrainingDays: model.preferredTrainingDays ?? [],
    exerciseRestrictions: model.exerciseRestrictions ?? "",
    additionalPreferences: model.additionalPreferences ?? "",
    allowAiPersonalization: model.allowAiPersonalization,
  };
}

function toRequest(values: TrainingProfileFormValues): SaveTrainingProfileRequest {
  return {
    goal: values.goal,
    experienceLevel: values.experienceLevel,
    preferredTrainingDaysPerWeek: values.preferredTrainingDaysPerWeek,
    preferredWorkoutDurationMinutes: values.preferredWorkoutDurationMinutes
      ? Number(values.preferredWorkoutDurationMinutes)
      : undefined,
    weightUnit: values.weightUnit,
    availableEquipment: values.availableEquipment,
    preferredTrainingDays: values.preferredTrainingDays,
    exerciseRestrictions: values.exerciseRestrictions.trim() || undefined,
    additionalPreferences: values.additionalPreferences.trim() || undefined,
    allowAiPersonalization: values.allowAiPersonalization,
  };
}

export function useTrainingProfilePage() {
  const [formValues, setFormValues] = useState<TrainingProfileFormValues>(defaultFormValues);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        const response = await trainingProfileService.get();
        const model = response.data.success ? (response.data.data ?? null) : null;
        if (!isCancelled && model) {
          setFormValues(toFormValues(model));
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load training profile.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isCancelled = true;
    };
  }, []);

  const setField = useCallback(
    <K extends keyof TrainingProfileFormValues>(field: K, value: TrainingProfileFormValues[K]) => {
      setSuccessMessage(null);
      setFormValues((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const toggleEquipment = useCallback((name: string) => {
    setSuccessMessage(null);
    setFormValues((current) => ({
      ...current,
      availableEquipment: current.availableEquipment.includes(name)
        ? current.availableEquipment.filter((item) => item !== name)
        : [...current.availableEquipment, name],
    }));
  }, []);

  const toggleTrainingDay = useCallback((day: DayOfWeek) => {
    setSuccessMessage(null);
    setFormValues((current) => ({
      ...current,
      preferredTrainingDays: current.preferredTrainingDays.includes(day)
        ? current.preferredTrainingDays.filter((item) => item !== day)
        : [...current.preferredTrainingDays, day],
    }));
  }, []);

  const save = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setSuccessMessage(null);
      setIsSaving(true);

      try {
        const response = await trainingProfileService.save(toRequest(formValues));
        setFormValues(toFormValues(unwrap(response.data, "Unable to save training profile.")));
        setSuccessMessage("Training profile saved.");
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Unable to save training profile.",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [formValues],
  );

  const state = useMemo(
    () => ({ formValues, isLoading, isSaving, error, successMessage }),
    [formValues, isLoading, isSaving, error, successMessage],
  );

  const actions = useMemo(
    () => ({ setField, toggleEquipment, toggleTrainingDay, save }),
    [setField, toggleEquipment, toggleTrainingDay, save],
  );

  return { state, actions };
}
