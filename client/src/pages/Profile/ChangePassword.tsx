import { PrimaryButton } from "@/shared/components/Buttons";
import { useChangePasswordPage } from "./hooks/useChangePasswordPage";

export default function ChangePassword() {
  const { state, actions } = useChangePasswordPage();

  return (
    <div className="liquid-panel rounded-2xl p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-foreground">Change Password</h2>
        <p className="mt-1 text-sm text-secondary">
          Choose a strong password of at least 8 characters.
        </p>
      </div>

      <form className="grid gap-4" onSubmit={actions.save}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-secondary" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            value={state.formValues.currentPassword}
            onChange={actions.changeField}
            autoComplete="current-password"
            className="liquid-input mt-2 w-full rounded-full px-3 py-2.5"
            placeholder="Enter your current password"
          />
          <p className="text-xs text-tertiary">
            Leave blank if you signed in with Google and haven&apos;t set a password yet.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-secondary" htmlFor="newPassword">
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            value={state.formValues.newPassword}
            onChange={actions.changeField}
            autoComplete="new-password"
            className="liquid-input mt-2 w-full rounded-full px-3 py-2.5"
            placeholder="Enter a new password"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-secondary" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            value={state.formValues.confirmPassword}
            onChange={actions.changeField}
            autoComplete="new-password"
            className="liquid-input mt-2 w-full rounded-full px-3 py-2.5"
            placeholder="Re-enter the new password"
          />
        </div>

        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        {state.successMessage ? (
          <p className="text-sm text-success">{state.successMessage}</p>
        ) : null}

        <div className="flex justify-end">
          <PrimaryButton type="submit" disabled={!state.canSubmit} className="w-full md:w-auto">
            {state.isSaving ? "Saving..." : "Change Password"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
