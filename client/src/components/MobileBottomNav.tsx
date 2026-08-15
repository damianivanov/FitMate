import { NavLink } from "react-router";
import { LuDumbbell, LuPlus } from "react-icons/lu";
import { useUserStore } from "@/stores/userStore";
import {
  selectIsActiveWorkout,
  selectIsWorkoutRunning,
  useActiveWorkoutStore,
} from "@/stores/activeWorkoutStore";
import { mobileTabItems, type NavItem } from "./navigation";

type MobileBottomNavProps = {
  onNavigate: () => void;
};

const leadingTabItems = mobileTabItems.slice(0, 2);
const trailingTabItems = mobileTabItems.slice(2);

function BottomTab({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const Icon = item.icon;

  return (
    <li className="flex justify-center">
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        aria-label={item.label}
        title={item.label}
        className={({ isActive }) =>
          `liquid-bottom-tab liquid-press ${isActive ? "liquid-bottom-tab-active" : ""}`}
      >
        {({ isActive }) => (
          <Icon className="h-5 w-5" strokeWidth={isActive ? 2.6 : 1.9} />
        )}
      </NavLink>
    </li>
  );
}

export default function MobileBottomNav({ onNavigate }: MobileBottomNavProps) {
  const { userLoaded, isAuthenticated } = useUserStore();
  const isWorkoutActive = useActiveWorkoutStore(selectIsActiveWorkout);
  const isWorkoutRunning = useActiveWorkoutStore(selectIsWorkoutRunning);
  const openNewWorkout = useActiveWorkoutStore((state) => state.openNewWorkout);
  const expand = useActiveWorkoutStore((state) => state.expand);

  if (!userLoaded || !isAuthenticated) {
    return null;
  }

  const actionLabel = isWorkoutActive ? "Resume workout" : "Start workout";
  const ActionIcon = isWorkoutActive ? LuDumbbell : LuPlus;

  return (
    <>
      {/* Decorative, and a sibling of the bar rather than a child of it: full-bleed across the
          extended app shell and one z-step below --z-nav, so content passing through the strip under the
          bar dissolves into a graduated blur while the bar itself is left completely alone. */}
      <span
        className="liquid-lens liquid-lens-bottom liquid-mobile-bottom-nav-lens md:hidden"
        aria-hidden="true"
      />

      {/* px-4 + max-w-2xl deliberately mirror PageBody's gutter and the pages' content width,
          so the bar lines up with the column it sits under instead of being a narrower object
          floating inside it. Keep these in step with .liquid-mobile-bottom-nav-lens. */}
      <nav
        aria-label="Primary"
        className="liquid-mobile-bottom-nav-shell pointer-events-none absolute inset-x-0 bottom-0 z-[var(--z-nav)] px-4 md:hidden"
      >
        <div className="liquid-mobile-bottom-nav pointer-events-auto mx-auto w-full max-w-2xl rounded-full px-1.5 py-1.5">
          <ul className="liquid-bottom-nav-grid">
            {leadingTabItems.map((item) => (
              <BottomTab key={item.to} item={item} onNavigate={onNavigate} />
            ))}

            <li className="flex justify-center px-2">
              <button
                type="button"
                onClick={() => (isWorkoutActive ? expand() : openNewWorkout())}
                aria-label={actionLabel}
                title={actionLabel}
                className="liquid-bottom-tab liquid-press"
              >
                <span
                  className={`liquid-bottom-action ${isWorkoutRunning ? "liquid-dumbbell-active" : ""}`}
                >
                  <ActionIcon className="h-6 w-6" strokeWidth={2.25} />
                </span>
              </button>
            </li>

            {trailingTabItems.map((item) => (
              <BottomTab key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
