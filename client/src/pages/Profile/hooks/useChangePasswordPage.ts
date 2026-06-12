import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { unwrap } from "@/lib/unwrap";
import { authService } from "@/services/authService";

type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const EMPTY_FORM: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const MIN_PASSWORD_LENGTH = 8;

export function useChangePasswordPage() {
  const [formValues, setFormValues] = useState<ChangePasswordFormValues>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const changeField = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    if (name !== "currentPassword" && name !== "newPassword" && name !== "confirmPassword") {
      return;
    }

    setSuccessMessage(null);
    setError(null);
    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value,
    }));
  }, []);

  const passwordsMatch = formValues.newPassword === formValues.confirmPassword;
  const newPasswordIsLongEnough = formValues.newPassword.length >= MIN_PASSWORD_LENGTH;
  const canSubmit = !isSaving && newPasswordIsLongEnough && passwordsMatch;

  const save = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSuccessMessage(null);
      setError(null);

      if (formValues.newPassword.length < MIN_PASSWORD_LENGTH) {
        setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }

      if (formValues.newPassword !== formValues.confirmPassword) {
        setError("New passwords do not match.");
        return;
      }

      setIsSaving(true);

      try {
        const response = await authService.changePassword({
          currentPassword: formValues.currentPassword,
          newPassword: formValues.newPassword,
        });
        unwrap(response.data, "Unable to change password.");

        setFormValues(EMPTY_FORM);
        setSuccessMessage("Password changed successfully.");
      } catch (submissionError) {
        const message = axios.isAxiosError(submissionError)
          ? (submissionError.response?.data?.error as string | undefined) ?? submissionError.message
          : submissionError instanceof Error
            ? submissionError.message
            : "Unable to change password.";
        setError(message);
      } finally {
        setIsSaving(false);
      }
    },
    [formValues.currentPassword, formValues.newPassword, formValues.confirmPassword],
  );

  const state = useMemo(
    () => ({
      formValues,
      isSaving,
      error,
      successMessage,
      canSubmit,
    }),
    [formValues, isSaving, error, successMessage, canSubmit],
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
