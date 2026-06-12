import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { Link } from "react-router";
import { PrimaryButton } from "@/shared/components/Buttons";
import { authService } from "@/services/authService";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await authService.forgotPassword({ email: email.trim() });
      const result = response.data;

      if (!result.success) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch (submissionError) {
      const message = axios.isAxiosError(submissionError)
        ? (submissionError.response?.data?.error as string | undefined) ?? submissionError.message
        : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  return (
    <div className="w-full flex-1 flex items-center justify-center px-5 py-8">
      <div className="liquid-surface w-full max-w-md rounded-3xl p-6 md:p-7 space-y-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-primary">Forgot password</h1>
          <p className="text-sm text-secondary">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm text-success">
              If an account exists for that email, a reset link is on its way. Check your inbox
              (and spam folder).
            </p>
            <Link to="/login" className="liquid-link text-sm font-semibold">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form className="space-y-4" onSubmit={onSubmit} autoComplete="on">
              <div className="space-y-2">
                <label className="text-sm font-medium text-secondary" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="liquid-input w-full rounded-full px-3 py-2.5 mt-2"
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <PrimaryButton type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Sending..." : "Send reset link"}
              </PrimaryButton>
            </form>

            <p className="flex items-center gap-2 text-sm text-secondary">
              Remembered it?{" "}
              <Link to="/login" className="liquid-link font-semibold">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
