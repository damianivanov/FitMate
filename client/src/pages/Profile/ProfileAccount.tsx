import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { PrimaryButton } from "@/shared/components/Buttons";
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

function ProfileAccount() {
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

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    if (name !== "firstName" && name !== "lastName") {
      return;
    }

    setSuccessMessage(null);
    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      const response = await authService.updateProfile({
        firstName: normalizedFormValues.firstName,
        lastName: normalizedFormValues.lastName || undefined,
      });
      const result = response.data;

      if (!result.success) {
        setError(result.error ?? "Unable to update profile.");
        return;
      }

      await initUser();
      setSuccessMessage("Profile updated successfully.");
    } catch (submissionError) {
      const message = axios.isAxiosError(submissionError)
        ? (submissionError.response?.data?.error as string | undefined) ?? submissionError.message
        : "Unable to update profile.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="liquid-panel rounded-2xl p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-foreground">Account Details</h2>
      </div>

      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-secondary" htmlFor="firstName">
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            value={formValues.firstName}
            onChange={handleFieldChange}
            autoComplete="given-name"
            className="liquid-input mt-2 w-full rounded-full px-3 py-2.5"
            placeholder="Enter your first name"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-secondary" htmlFor="lastName">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            value={formValues.lastName}
            onChange={handleFieldChange}
            autoComplete="family-name"
            className="liquid-input mt-2 w-full rounded-full px-3 py-2.5"
            placeholder="Enter your last name"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-secondary" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            readOnly
            value={user.email}
            className="liquid-input mt-2 w-full cursor-not-allowed rounded-full px-3 py-2.5 text-tertiary"
          />
        </div>

        {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
        {successMessage ? (
          <p className="text-sm text-success md:col-span-2">{successMessage}</p>
        ) : null}

        <div className="flex justify-end md:col-span-2">
          <PrimaryButton
            type="submit"
            disabled={isSaving || !isDirty || normalizedFormValues.firstName.length === 0}
            className="w-full md:w-auto"
          >
            {isSaving ? "Saving..." : "Save Profile"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

export default ProfileAccount;
