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
    <nav
      aria-label="Primary"
      className="liquid-mobile-bottom-nav-shell pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-nav)] px-3 md:hidden"
    >
      <div className="liquid-mobile-bottom-nav pointer-events-auto mx-auto w-full max-w-lg rounded-full px-1.5 py-1.5">
        <ul className="grid grid-cols-5">
          {leadingTabItems.map((item) => (
            <BottomTab key={item.to} item={item} onNavigate={onNavigate} />
          ))}

          <li className="flex justify-center">
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
  );
}
