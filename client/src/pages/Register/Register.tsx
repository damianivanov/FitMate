import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PrimaryButton } from "@/shared/components/Buttons";
import { useUserStore } from "@/stores/userStore";

export default function Register() {
  const navigate = useNavigate();
  const register = useUserStore((state) => state.register);
  const isLoading = useUserStore((state) => state.isLoading);
  const error = useUserStore((state) => state.error);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const isSuccess = await register({
      email,
      password,
      firstName: "",
      lastName: "",
    });

    if (isSuccess) {
      navigate("/login");
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
      <div className="liquid-surface w-full max-w-sm rounded-3xl p-6 md:p-7 space-y-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-slate-900">Create Account</h1>
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
            <label className="text-sm font-medium text-slate-700" htmlFor="password">
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

          {error && <p className="text-sm text-red-700">{error}</p>}

          <PrimaryButton type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Creating account..." : "Create account"}
          </PrimaryButton>
        </form>

        <p className="text-sm text-slate-600">
          Already tracking with us?{" "}
          <Link to="/login" className="liquid-link font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
