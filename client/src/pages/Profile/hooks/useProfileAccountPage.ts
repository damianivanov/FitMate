import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { unwrap } from "@/lib/unwrap";
import { authService } from "@/services/authService";
import { useUserStore } from "@/stores/userStore";

type ProfileFormValues = {
  firstName: string;
  lastName: string;
};

function getInitialFormValues(firstName?: string, lastName?: string): ProfileFormValues {
  return {
    firstName: firstName?.trim() ?? "",
    lastName: lastName?.trim() ?? "",
  };
}

function normalizeValues(values: ProfileFormValues): ProfileFormValues {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
  };
}

function valuesAreEqual(a: ProfileFormValues, b: ProfileFormValues): boolean {
  const left = normalizeValues(a);
  const right = normalizeValues(b);
  return left.firstName === right.firstName && left.lastName === right.lastName;
}

export function useProfileAccountPage() {
  const { user, initUser } = useUserStore();

  const [formValues, setFormValues] = useState<ProfileFormValues>({
    firstName: "",
    lastName: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const initialFormValues = useMemo(
    () => getInitialFormValues(user.firstName, user.lastName),
    [user.firstName, user.lastName],
  );

  useEffect(() => {
    setFormValues(initialFormValues);
  }, [initialFormValues]);

  const isDirty = useMemo(
    () => !valuesAreEqual(formValues, initialFormValues),
    [formValues, initialFormValues],
  );

  const normalizedFormValues = useMemo(() => normalizeValues(formValues), [formValues]);

  const changeField = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    if (name !== "firstName" && name !== "lastName") {
      return;
    }

    setSuccessMessage(null);
    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value,
    }));
  }, []);

  const save = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSuccessMessage(null);
      setError(null);
      setIsSaving(true);

      try {
        const response = await authService.updateProfile({
          firstName: normalizedFormValues.firstName,
          lastName: normalizedFormValues.lastName || undefined,
        });
        unwrap(response.data, "Unable to update profile.");

        await initUser();
        setSuccessMessage("Profile updated successfully.");
      } catch (submissionError) {
        const message = axios.isAxiosError(submissionError)
          ? (submissionError.response?.data?.error as string | undefined) ?? submissionError.message
          : submissionError instanceof Error
            ? submissionError.message
            : "Unable to update profile.";
        setError(message);
      } finally {
        setIsSaving(false);
      }
    },
    [initUser, normalizedFormValues.firstName, normalizedFormValues.lastName],
  );

  const state = useMemo(
    () => ({
      email: user.email,
      formValues,
      isSaving,
      error,
      successMessage,
      isDirty,
      canSubmit: !isSaving && isDirty && normalizedFormValues.firstName.length > 0,
    }),
    [user.email, formValues, isSaving, error, successMessage, isDirty, normalizedFormValues.firstName],
  );

  const actions = useMemo(
    () => ({
      changeField,
      save,
    }),
    [changeField, save],
  );

  return { state, actions };
}
