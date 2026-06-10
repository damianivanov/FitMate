import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router";
import { PrimaryButton } from "@/shared/components/Buttons";
import { authService } from "@/services/authService";
import { useUserStore } from "@/stores/userStore";

export default function Register() {
  const navigate = useNavigate();
  const { initUser } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.register({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      const result = response.data;

      if (!result.success) {
        setError(result.error ?? "Registration failed.");
        return;
      }

      await initUser();
      navigate("/login");
    } catch (submissionError) {
      const message = axios.isAxiosError(submissionError)
        ? (submissionError.response?.data?.error as string | undefined) ?? submissionError.message
        : "Registration failed.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFirstName(event.target.value);
  };

  const handleLastNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLastName(event.target.value);
  };

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleConfirmPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(event.target.value);
  };

  return (
    <div className="w-full flex-1 flex items-center justify-center px-5 py-8">
      <div className="liquid-surface w-full max-w-sm rounded-3xl p-6 md:p-7 space-y-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-primary">Create Account</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-secondary" htmlFor="firstName">
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                value={firstName}
                onChange={handleFirstNameChange}
                autoComplete="given-name"
                autoCapitalize="words"
                className="liquid-input w-full rounded-full px-3 py-2.5 mt-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-secondary" htmlFor="lastName">
                Last name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={lastName}
                onChange={handleLastNameChange}
                autoComplete="family-name"
                autoCapitalize="words"
                className="liquid-input w-full rounded-full px-3 py-2.5 mt-2"
              />
            </div>
          </div>

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
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="liquid-input w-full rounded-full px-3 py-2.5 mt-2"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-secondary" htmlFor="password">
              Password
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
              Confirm password
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

          {error && <p className="text-sm text-danger text-center">{error}</p>}

          <PrimaryButton type="submit" disabled={isLoading} className="w-full mt-6">
            {isLoading ? "Creating account..." : "Create account"}
          </PrimaryButton>
        </form>

        <p className="text-sm text-secondary text-center">
          Already tracking with us?{" "}
          <Link to="/login" className="liquid-link font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
