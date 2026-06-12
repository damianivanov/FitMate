import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router";
import { PrimaryButton } from "@/shared/components/Buttons";
import { authService } from "@/services/authService";
import { useUserStore } from "@/stores/userStore";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function Login() {
  const navigate = useNavigate();
  const { initUser, isAuthenticated } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "").trim();
    const submittedPassword = String(formData.get("password") ?? "");

    setEmail(submittedEmail);
    setPassword(submittedPassword);
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        email: submittedEmail,
        password: submittedPassword,
      });
      const result = response.data;

      if (!result.success) {
        setError(result.error ?? "Login failed.");
        return;
      }

      await initUser();

      if (isAuthenticated) {
        navigate("/");
        return;
      }

      setError("Login succeeded but loading the current user failed.");
    } catch (submissionError) {
      const message = axios.isAxiosError(submissionError)
        ? (submissionError.response?.data?.error as string | undefined) ?? submissionError.message
        : "Login failed.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  return (
    <div className="w-full flex-1 flex items-center justify-center px-5 py-8">
      <div className="liquid-surface w-full max-w-md rounded-3xl p-6 md:p-7 space-y-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-primary">Welcome Back</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit} autoComplete="on">
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
            className="liquid-input w-full rounded-full px-3 py-2.5"
          />

          <input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={handlePasswordChange}
            autoComplete="current-password"
            className="liquid-input w-full rounded-full px-3 py-2.5"
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <PrimaryButton type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Signing in..." : "Sign In"}
          </PrimaryButton>

          <div className="flex justify-between text-sm">
            <Link to="/forgot-password" className="liquid-link">
              Forgot password?
            </Link>
            
            <Link to="/register" className="liquid-link">
              Create account
            </Link>            
          </div>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-current opacity-10" />
          <span className="text-xs font-medium uppercase tracking-wide text-tertiary">or</span>
          <span className="h-px flex-1 bg-current opacity-10" />
        </div>

        <GoogleSignInButton onError={setError} />
      </div>
    </div>
  );
}

