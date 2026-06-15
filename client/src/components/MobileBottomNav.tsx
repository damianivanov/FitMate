import { NavLink } from "react-router";
import { useUserStore } from "@/stores/userStore";
import {
  selectIsActiveWorkout,
  selectIsWorkoutRunning,
  useActiveWorkoutStore,
} from "@/stores/activeWorkoutStore";
import { mobileBottomNavItems } from "./navigation";

type MobileBottomNavProps = {
  onNavigate: () => void;
};

const baseBottomNavLinkClassName =
  "flex h-10 w-10 items-center justify-center rounded-full transition-colors";

const bottomNavLinkClassName = `${baseBottomNavLinkClassName} text-amber-50/75`;

const activeBottomNavLinkClassName = `${baseBottomNavLinkClassName} text-primary ring-1 ring-inset ring-primary/25`;

const primaryActionBottomNavLinkClassName = [
  "liquid-press flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white transition",
  "ring-1 ring-primary-300/45 shadow-[0_10px_24px_rgba(var(--primary-rgb),0.26)]",
].join(" ");

function getBottomNavLinkClassName(isActive: boolean, isPrimaryAction = false): string {
  if (isPrimaryAction) {
    return primaryActionBottomNavLinkClassName;
  }

  return isActive ? activeBottomNavLinkClassName : bottomNavLinkClassName;
}

function getBottomNavIconClassName(): string {
  return "h-5 w-5";
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

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="liquid-mobile-bottom-nav-shell pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-nav)] px-3 md:hidden"
    >
      <div className="liquid-mobile-bottom-nav pointer-events-auto mx-auto h-14 w-full max-w-lg rounded-full px-2">
        <ul className="grid h-full grid-cols-5 place-items-center">
          {mobileBottomNavItems.map((item) => {
            const Icon = item.icon;

            // The center dumbbell button represents the active workout: it expands a
            // running one (blinking while active) or starts a new one.
            if (item.isPrimaryAction) {
              return (
                <li key={item.to}>
                  <button
                    type="button"
                    onClick={() => (isWorkoutActive ? expand() : openNewWorkout())}
                    aria-label={isWorkoutActive ? "Resume workout" : "Start workout"}
                    className={[
                      getBottomNavLinkClassName(false, true),
                      isWorkoutRunning ? "liquid-dumbbell-active" : "",
                    ].join(" ")}
                  >
                    <Icon className={getBottomNavIconClassName()} strokeWidth={2} />
                  </button>
                </li>
              );
            }

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    getBottomNavLinkClassName(isActive, item.isPrimaryAction)}
                >
                  <Icon
                    className={getBottomNavIconClassName()}
                    strokeWidth={2}
                  />
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
