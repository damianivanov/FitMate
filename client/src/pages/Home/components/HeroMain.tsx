import { LuArrowRight } from "react-icons/lu";
import { useNavigate } from "react-router";
import { OutlinedButton, PrimaryButton } from "@/shared/components";
import { useUserStore } from "@/stores/userStore";
import heroImage from "@/assets/hero_image.png";

export default function HeroMain() {
  const navigate = useNavigate();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  const primary = isAuthenticated
    ? { label: "Go to dashboard", to: "/workouts" }
    : { label: "Create free account", to: "/register" };
  const secondary = isAuthenticated
    ? { label: "Start a workout", to: "/workouts/new" }
    : { label: "Log in", to: "/login" };

  return (
    <section className="liquid-surface flex flex-col overflow-hidden rounded-3xl p-3">
      <div className="relative flex flex-1 flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-primary-300 opacity-40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-primary-200 opacity-30 blur-3xl"
        />

        <div className="relative p-6 text-center md:px-12 md:pt-8">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground md:text-5xl">
            Every set, every rep, <span className="text-primary">one workout log.</span>
          </h1>
        </div>

        <img
          src={heroImage}
          alt="FitMate app showing a live workout session, a progress chart, and a weekly streak"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="relative hidden aspect-[16/9] w-full object-cover rounded-3xl md:block md:aspect-auto md:min-h-0 md:flex-1"
        />

        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-secondary md:text-lg">
          FitMate is a complete strength-training tracker. Build sessions from reusable
          templates, log your sets as you lift, and watch your volume, records, and streaks
          climb over time.
        </p>

        <div className="relative px-6 pt-8 pb-10 text-center md:px-12 md:pb-14">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryButton className="w-full sm:w-auto" onClick={() => navigate(primary.to)}>
              {primary.label}
              <LuArrowRight className="h-4 w-4" />
            </PrimaryButton>
            <OutlinedButton className="w-full sm:w-auto" onClick={() => navigate(secondary.to)}>
              {secondary.label}
            </OutlinedButton>
          </div>
        </div>
      </div>
    </section>
  );
}
