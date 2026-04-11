import { PrimaryButton } from "@/shared/components/Buttons";
import { useNavigate } from "react-router";

export default function HeroMain() {
  const navigate = useNavigate();
  const handleOpenFitMate = () => {
    navigate("/");
  };

  return (
    <div className="liquid-surface relative overflow-hidden rounded-3xl p-8 md:p-10">
      <p className="mb-4 text-center text-xs font-bold tracking-[0.24em] text-tertiary uppercase">
        Fitness Tracking
      </p>

      <h1 className="mb-3 text-center text-3xl font-extrabold leading-tight text-primary md:text-5xl">
        Track workouts, goals, and progress from one place.
      </h1>

      <p className="mx-auto max-w-2xl text-center text-sm md:text-base leading-relaxed text-secondary">
        FitMate gives you secure access, role-aware flows, and a clean base to grow your fitness platform.
      </p>

      <div className="mt-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <PrimaryButton className="w-full md:w-auto" onClick={handleOpenFitMate}>
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

