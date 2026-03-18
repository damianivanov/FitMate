import { Link } from "react-router-dom";
import { LuArrowLeft, LuHistory, LuListChecks } from "react-icons/lu";

export default function WorkoutHistory() {
  return (
    <div className="w-full flex-1 px-5 py-8">
      <div className="mx-auto w-full max-w-[79dvw] space-y-6">
        <header className="space-y-2">
          <Link
            to="/workouts"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            <LuArrowLeft className="h-4 w-4" />
            Back to Workouts
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900">Workout Listing</h1>
          <p className="text-sm text-slate-600">
            This area is ready for the workouts list integration and is intentionally kept as a focused placeholder.
          </p>
        </header>

        <section className="liquid-surface rounded-3xl p-5 md:p-6">
          <div className="liquid-soft-surface rounded-2xl p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="liquid-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-slate-700">
                <LuHistory className="h-3.5 w-3.5" />
                Coming online soon
              </span>
              <span className="liquid-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-slate-700">
                <LuListChecks className="h-3.5 w-3.5" />
                List and filters
              </span>
            </div>

            <p className="mt-4 text-sm text-slate-700">
              Next step here is wiring a real workouts grid/list with search, date filters, and quick re-open actions.
            </p>

            <div className="mt-5">
              <Link to="/workouts/new" className="liquid-primary-btn inline-flex rounded-full px-4 py-2.5 text-sm font-semibold">
                Create a Workout
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
