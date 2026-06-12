import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router";
import { PrimaryButton } from "@/shared/components/Buttons";
import { authService } from "@/services/authService";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const hasValidLink = email.length > 0 && token.length > 0;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.resetPassword({
        email,
        token,
        newPassword: password,
      });
      const result = response.data;

      if (!result.success) {
        setError(result.error ?? "Invalid or expired reset link.");
        return;
      }

      setDone(true);
    } catch (submissionError) {
      const message = axios.isAxiosError(submissionError)
        ? (submissionError.response?.data?.error as string | undefined) ?? submissionError.message
        : "Invalid or expired reset link.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleConfirmPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(event.target.value);
  };

  return (
    <div className="w-full flex-1 flex items-center justify-center px-5 py-8">
      <div className="liquid-surface w-full max-w-md rounded-3xl p-6 md:p-7 space-y-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-primary">Reset password</h1>
        </div>

        {!hasValidLink ? (
          <div className="space-y-4">
            <p className="text-sm text-danger">
              This reset link is invalid or incomplete. Please request a new one.
            </p>
            <Link to="/forgot-password" className="liquid-link text-sm font-semibold">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="space-y-4">
            <p className="text-sm text-success">
              Your password has been reset. You can now sign in with your new password.
            </p>
            <Link to="/login" className="liquid-link text-sm font-semibold">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-secondary" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={handlePasswordChange}
                autoComplete="new-password"
                className="liquid-input w-full rounded-full px-3 py-2.5 mt-2"
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
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                autoComplete="new-password"
                className="liquid-input w-full rounded-full px-3 py-2.5 mt-2"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <PrimaryButton type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Resetting..." : "Reset password"}
            </PrimaryButton>
          </form>
        )}
      </div>
    </div>
  );
}
