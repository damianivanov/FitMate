import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PrimaryButton } from "@/shared/components/Buttons";
import { useUserStore } from "@/stores/userStore";

export default function Login() {
  const navigate = useNavigate();
  const login = useUserStore((state) => state.login);
  const isLoading = useUserStore((state) => state.isLoading);
  const error = useUserStore((state) => state.error);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const isSuccess = await login({
      email,
      password,
    });

    if (isSuccess) {
      navigate("/");
    }
  };

  return (
    <div className="w-full flex-1 flex items-center justify-center px-5 py-8">
      <div className="liquid-surface w-full max-w-md rounded-3xl p-6 md:p-7 space-y-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-slate-900">Welcome Back</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="liquid-input w-full rounded-xl px-3 py-2.5 mt-2"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="liquid-input w-full rounded-xl px-3 py-2.5 mt-2"
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <PrimaryButton type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Signing in..." : "Sign In"}
          </PrimaryButton>
        </form>

        <p className="text-sm text-slate-600">
          New to FitMate?{" "}
          <Link to="/register" className="liquid-link font-semibold">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
