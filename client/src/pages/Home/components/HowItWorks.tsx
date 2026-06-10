import type { IconType } from "react-icons";
import { LuDumbbell, LuLayoutTemplate, LuTrendingUp } from "react-icons/lu";

type Step = {
  step: string;
  icon: IconType;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    step: "01",
    icon: LuLayoutTemplate,
    title: "Pick or build a routine",
    description: "Start from a saved template or assemble exercises by muscle group.",
  },
  {
    step: "02",
    icon: LuDumbbell,
    title: "Log as you lift",
    description: "Tick off each set with its weight and reps — no spreadsheet, no guesswork.",
  },
  {
    step: "03",
    icon: LuTrendingUp,
    title: "Watch progress add up",
    description: "Volume, records, and streaks update automatically after every session.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works">
      <div className="mb-6 max-w-2xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">
          How it works
        </p>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
          From first set to long-term progress
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {STEPS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.step} className="liquid-panel rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <span className="liquid-primary-chip inline-flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <h3 className="mt-4 mb-1.5 font-extrabold text-foreground">{item.title}</h3>
              <p className="text-sm leading-snug text-secondary">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
