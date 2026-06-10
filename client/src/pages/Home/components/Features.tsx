import type { IconType } from "react-icons";
import {
  LuActivity,
  LuCalendarDays,
  LuDumbbell,
  LuImages,
  LuLayoutTemplate,
  LuTrophy,
} from "react-icons/lu";

type Feature = {
  icon: IconType;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: LuDumbbell,
    title: "Live workout logging",
    description:
      "Run a session set by set — log weight, reps, and set types as you train, with a running tally of volume and time.",
  },
  {
    icon: LuLayoutTemplate,
    title: "Reusable templates",
    description:
      "Save any routine as a template, start a workout from it in one tap, or turn a finished session back into a template.",
  },
  {
    icon: LuActivity,
    title: "Progress analytics",
    description:
      "Follow your total volume over time, estimated 1RM progression per exercise, and how work splits across muscle groups.",
  },
  {
    icon: LuTrophy,
    title: "Personal records",
    description:
      "Your best effort on every exercise is captured automatically, so each PR is always one tap away.",
  },
  {
    icon: LuCalendarDays,
    title: "Calendar & streaks",
    description:
      "See every session on a monthly calendar, keep your day-streak alive, and reuse a past workout instantly.",
  },
  {
    icon: LuImages,
    title: "Exercise library",
    description:
      "Browse a shared catalog with reference photos, filter by muscle group, and add your own custom exercises.",
  },
];

export default function Features() {
  return (
    <section id="features">
      <div className="mb-6 max-w-2xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">
          What FitMate does
        </p>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
          Everything you need to train and track
        </h2>
        <p className="mt-2 text-secondary">
          One place to plan workouts, log them as you go, and see the numbers add up.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="liquid-surface liquid-hover-lift rounded-2xl p-5 transition duration-200"
            >
              <span className="liquid-primary-chip mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mb-1.5 font-extrabold text-foreground">{feature.title}</h3>
              <p className="text-sm leading-snug text-secondary">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
