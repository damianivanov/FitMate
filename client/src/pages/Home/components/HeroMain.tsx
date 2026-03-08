import { PrimaryButton } from "@/shared/components/Buttons";
import { useNavigate } from "react-router";

export default function HeroMain() {
  const navigate = useNavigate();

  return (
    <div className="liquid-surface relative overflow-hidden rounded-3xl p-8 md:p-10">
      <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-blue-300/35 blur-3xl" />

      <p className="mb-4 text-center text-xs font-bold tracking-[0.24em] text-slate-500 uppercase">
        Fitness Tracking
      </p>

      <h1 className="text-center text-3xl md:text-5xl font-extrabold leading-tight mb-3 bg-linear-to-r from-slate-900 via-sky-900 to-blue-700 bg-clip-text text-transparent">
        Track workouts, goals, and progress from one place.
      </h1>

      <p className="mx-auto max-w-2xl text-center text-sm md:text-base leading-relaxed text-slate-600">
        FitMate gives you secure access, role-aware flows, and a clean base to grow your fitness platform.
      </p>

      <div className="mt-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <PrimaryButton className="w-full md:w-auto" onClick={() => navigate("/")}>
          Open FitMate
        </PrimaryButton>

        <div className="flex gap-3 flex-wrap text-xs">
          <span className="liquid-pill inline-flex gap-2 items-center rounded-xl px-3 py-2 font-semibold">
            Workout-ready
          </span>
          <span className="liquid-pill inline-flex gap-2 items-center rounded-xl px-3 py-2 font-semibold">
            JWT + refresh tokens
          </span>
          <span className="liquid-pill inline-flex gap-2 items-center rounded-xl px-3 py-2 font-semibold">
            Role-based access
          </span>
        </div>
      </div>
    </div>
  );
}
