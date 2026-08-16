import { Link, NavLink } from "react-router";
import { LuChevronRight, LuDumbbell, LuLogOut, LuMoon, LuPlus, LuSun } from "react-icons/lu";
import { isAdmin as hasAdminRole } from "@/lib/access";
import { buildDisplayName, buildInitials } from "@/lib/helpers";
import { selectIsActiveWorkout, useActiveWorkoutStore } from "@/stores/activeWorkoutStore";
import { useThemeStore } from "@/stores/themeStore";
import { useUserStore } from "@/stores/userStore";
import AppLogo from "./AppLogo";
import Avatar from "./Avatar";
import { navSections } from "./navigation";

export default function DesktopSidebar() {
  const { user, logout } = useUserStore();
  const isWorkoutActive = useActiveWorkoutStore(selectIsActiveWorkout);
  const openNewWorkout = useActiveWorkoutStore((state) => state.openNewWorkout);
  const expandWorkout = useActiveWorkoutStore((state) => state.expand);
  const { theme, setTheme } = useThemeStore();

  const isAdminUser = hasAdminRole(user);
  const isLightMode = theme === "light";
  const displayName = buildDisplayName(user.firstName, user.lastName) || user.email;
  const initials = buildInitials(user.firstName, user.lastName, user.email);

  const handleWorkoutAction = () => {
    if (isWorkoutActive) {
      expandWorkout();
      return;
    }

    openNewWorkout();
  };

  const handleLogout = () => {
    void logout();
  };

  return (
    <aside className="desktop-sidebar" aria-label="Primary navigation">
      <AppLogo className="desktop-sidebar-logo" />

      <button
        type="button"
        onClick={handleWorkoutAction}
        className="desktop-sidebar-cta liquid-primary-btn liquid-press"
      >
        {isWorkoutActive ? <LuDumbbell className="h-4 w-4" /> : <LuPlus className="h-4 w-4" />}
        {isWorkoutActive ? "Resume workout" : "Start workout"}
      </button>

      <nav className="desktop-sidebar-nav liquid-scrollbar" aria-label="FitMate sections">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.requiresAdmin || isAdminUser,
          );

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <section key={section.section} className="desktop-sidebar-section">
              <p>{section.section}</p>
              <div>
                {visibleItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `desktop-sidebar-link ${isActive ? "is-active" : ""}`
                      }
                    >
                      <span className={`app-tile-icon tint-${item.tint}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <b>{item.label}</b>
                    </NavLink>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>

      <div className="desktop-sidebar-footer">
        <div
          className={`app-theme-box desktop-sidebar-theme ${isLightMode ? "is-light" : "is-dark"}`}
          role="group"
          aria-label="Appearance"
        >
          <span className="app-theme-thumb" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={theme === "dark" ? "is-active" : ""}
            aria-pressed={theme === "dark"}
          >
            <LuMoon className="h-4 w-4" aria-hidden="true" />
            Dark
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={isLightMode ? "is-active" : ""}
            aria-pressed={isLightMode}
          >
            <LuSun className="h-4 w-4" aria-hidden="true" />
            Light
          </button>
        </div>

        <Link to="/profile" className="desktop-sidebar-profile">
          <Avatar userId={user.id} initials={initials} imageUrl={user.avatarUrl} />
          <span>
            <b>{displayName}</b>
            <small>View profile</small>
          </span>
          <LuChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        <button type="button" onClick={handleLogout} className="desktop-sidebar-logout">
          <LuLogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  );
}
