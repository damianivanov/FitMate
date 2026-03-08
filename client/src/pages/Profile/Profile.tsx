import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FC, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PrimaryButton } from "@/shared/components/Buttons";
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

const Profile: FC = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const isInitialized = useUserStore((state) => state.isInitialized);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const isLoading = useUserStore((state) => state.isLoading);
  const error = useUserStore((state) => state.error);
  const updateProfile = useUserStore((state) => state.updateProfile);

  const [formValues, setFormValues] = useState<ProfileFormValues>({
    firstName: "",
    lastName: "",
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const initialFormValues = useMemo(
    () => getInitialFormValues(user?.firstName, user?.lastName),
    [user?.firstName, user?.lastName],
  );

  useEffect(() => {
    setFormValues(initialFormValues);
  }, [initialFormValues]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, isInitialized, navigate]);

  const isDirty = useMemo(
    () => !valuesAreEqual(formValues, initialFormValues),
    [formValues, initialFormValues],
  );

  const normalizedFormValues = useMemo(
    () => normalizeValues(formValues),
    [formValues],
  );

  const onFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);

    const isSuccess = await updateProfile({
      firstName: normalizedFormValues.firstName,
      lastName: normalizedFormValues.lastName || undefined,
    });
    if (isSuccess) {
      setSuccessMessage("Profile updated successfully.");
    }
  };

  return (
    <div className="w-full flex-1 flex items-center justify-center px-5 py-8">
      <div className="liquid-surface w-full max-w-md rounded-3xl p-6 md:p-7 space-y-5">
        <h1 className="text-3xl font-extrabold text-slate-900">Your Profile</h1>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="firstName">
              First Name
            </label>
            <input
              id="firstName"
              name="firstName"
              required
              value={formValues.firstName}
              onChange={onFieldChange}
              autoComplete="given-name"
              className="liquid-input w-full rounded-xl px-3 py-2.5 mt-2"
              placeholder="Enter your first name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="lastName">
              Last Name
            </label>
            <input
              id="lastName"
              name="lastName"
              value={formValues.lastName}
              onChange={onFieldChange}
              autoComplete="family-name"
              className="liquid-input w-full rounded-xl px-3 py-2.5 mt-2"
              placeholder="Enter your last name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              readOnly
              value={user?.email ?? ""}
              className="liquid-input w-full rounded-xl px-3 py-2.5 mt-2 text-slate-500 cursor-not-allowed"
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
          {successMessage && <p className="text-sm text-emerald-700">{successMessage}</p>}

          <PrimaryButton
            type="submit"
            disabled={isLoading || !isDirty || normalizedFormValues.firstName.length === 0}
            className="w-full mt-4"
          >
            {isLoading ? "Saving..." : "Save Profile"}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
};

export default Profile;
