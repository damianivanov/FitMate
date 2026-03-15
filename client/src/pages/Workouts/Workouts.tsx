import { Link } from "react-router-dom";
import { LuArrowRight, LuFolderClock, LuSparkles, LuSquarePen } from "react-icons/lu";
import type { IconType } from "react-icons";

type WorkoutAction = {
  to: string;
  title: string;
  description: string;
  badge: string;
  icon: IconType;
};

const workoutActions: WorkoutAction[] = [
  {
    to: "/workouts/new",
    title: "Create Workout",
    description: "Build a session quickly, pick exercises, and capture your sets in one flow.",
    badge: "Ready now",
    icon: LuSquarePen,
  },
  {
    to: "/workouts/history",
    title: "Workout Listing",
    description: "Browse and revisit logged sessions. History UI is available as an early preview.",
    badge: "Preview",
    icon: LuFolderClock,
  },
];

const upcomingItems = [
  "Workout templates with reusable structures",
  "Progress charts for volume and performance",
  "Smart suggestions based on previous sessions",
] as const;

export default function Workouts() {
  return (
    <div className="w-full flex-1 px-5 py-8">
      <div className="mx-auto w-full max-w-[79dvw] space-y-6">
        <section className="liquid-surface relative overflow-hidden rounded-3xl p-6 md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-300/50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-blue-300/40 blur-3xl" />

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/40 px-3 py-1 text-xs font-semibold text-slate-700">
              <LuSparkles className="h-3.5 w-3.5" />
              Workout Hub
            </div>
            <h1 className="max-w-2xl text-3xl font-extrabold text-slate-900 md:text-4xl">
              Your central space for creating, browsing, and evolving workouts.
            </h1>
            <p className="max-w-2xl text-sm text-slate-700 md:text-base">
              Start a new session in seconds, open workout history, and keep an eye on features already queued next.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {workoutActions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.to}
                to={action.to}
                className="liquid-surface group rounded-3xl p-5 transition hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/45 px-3 py-1 text-xs font-semibold text-slate-700">
                    <Icon className="h-3.5 w-3.5" />
                    {action.badge}
                  </span>
                  <LuArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5" />
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-900">{action.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{action.description}</p>
              </Link>
            );
          })}
        </section>

        <section className="liquid-surface rounded-3xl p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900">More to Come</h2>
          <p className="mt-1 text-sm text-slate-600">
            The workouts area is expanding. These are the next upgrades planned for this section.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {upcomingItems.map((item) => (
              <div key={item} className="rounded-2xl border border-white/60 bg-white/35 p-4">
                <p className="text-sm font-semibold text-slate-800">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
