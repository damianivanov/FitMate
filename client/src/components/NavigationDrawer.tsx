import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink } from "react-router";
import { LuChevronRight, LuLogOut, LuMoon, LuSearch, LuSun } from "react-icons/lu";
import { isAdmin as hasAdminRole } from "@/lib/access";
import { buildDisplayName, buildInitials } from "@/lib/helpers";
import {
  selectIsActiveWorkout,
  useActiveWorkoutStore,
} from "@/stores/activeWorkoutStore";
import { selectIsNavDrawerOpen, useNavDrawerStore } from "@/stores/navDrawerStore";
import { useThemeStore } from "@/stores/themeStore";
import { useUserStore } from "@/stores/userStore";
import AppLogo from "./AppLogo";
import Avatar from "./Avatar";
import MenuToggleIcon from "./MenuToggleIcon";
import { drawerNavItems } from "./navigation";

export default function NavigationDrawer() {
  const { user, logout } = useUserStore();
  const isOpen = useNavDrawerStore(selectIsNavDrawerOpen);
  const closeDrawer = useNavDrawerStore((state) => state.close);
  const isWorkoutActive = useActiveWorkoutStore(selectIsActiveWorkout);
  const openNewWorkout = useActiveWorkoutStore((state) => state.openNewWorkout);
  const expandWorkout = useActiveWorkoutStore((state) => state.expand);
  const { theme, setTheme } = useThemeStore();

  const [query, setQuery] = useState("");
  const [wasOpen, setWasOpen] = useState(isOpen);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // The search box only narrows the panel that is on screen, so a query left behind would
  // silently hide sections the next time the drawer opens.
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setQuery("");
  }

  const isAdminUser = hasAdminRole(user);
  const isLightMode = theme === "light";
  const displayName = buildDisplayName(user.firstName, user.lastName) || user.email;
  const initials = buildInitials(user.firstName, user.lastName, user.email);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return drawerNavItems.filter((item) => {
      if (item.requiresAdmin && !isAdminUser) {
        return false;
      }

      return !normalizedQuery || item.label.toLowerCase().includes(normalizedQuery);
    });
  }, [isAdminUser, query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, closeDrawer]);

  const handleLogout = () => {
    void logout();
    closeDrawer();
  };

  const handleStartWorkout = () => {
    closeDrawer();

    if (isWorkoutActive) {
      expandWorkout();
      return;
    }

    openNewWorkout();
  };

  return (
    <div className={`app-drawer-layer md:hidden ${isOpen ? "is-open" : ""}`} inert={!isOpen} aria-hidden={!isOpen}>
      <button
        type="button"
        className="app-layer-scrim"
        onClick={closeDrawer}
        aria-label="Close navigation"
      />

      <aside className="app-drawer" aria-label="All FitMate sections">
        <div className="app-drawer-head">
          <AppLogo />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            className="app-menu-toggle liquid-press"
            aria-label="Close navigation"
          >
            <MenuToggleIcon isOpen={isOpen} />
          </button>
        </div>

        <Link to="/profile" onClick={closeDrawer} className="app-drawer-profile">
          <Avatar userId={user.id} initials={initials} imageUrl={user.avatarUrl} size="lg" />
          <span className="app-drawer-profile-copy min-w-0">
            <b>{displayName}</b>
            <small>View your profile</small>
          </span>
          <LuChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        <button type="button" onClick={handleStartWorkout} className="app-drawer-cta liquid-primary-btn">
          {isWorkoutActive ? "Resume workout" : "Start workout"}
        </button>

        <label className="app-drawer-search">
          <LuSearch className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filter sections"
            placeholder="Search FitMate"
          />
        </label>

        <nav className="app-drawer-grid liquid-scrollbar" aria-label="Sections">
          {visibleItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeDrawer}
                className={({ isActive }) => `app-drawer-tile ${isActive ? "is-selected" : ""}`}
              >
                {({ isActive }) => (
                  <>
                    <span className={`app-tile-icon tint-${item.tint}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <b>{item.label}</b>
                    {isActive ? <i aria-hidden="true" /> : null}
                  </>
                )}
              </NavLink>
            );
          })}

          {visibleItems.length === 0 ? (
            <p className="app-drawer-empty">No sections match “{query.trim()}”.</p>
          ) : null}
        </nav>

        {/* Legal and cookie preferences moved to Profile → Account. What is left is the one
            control worth reaching the drawer for: the theme. */}
        <div className="app-drawer-footer">
          {/* Two labelled boxes rather than a sliding switch: a switch only says on/off, and
              which side means dark has to be learned. Naming both states removes the guess. */}
          <div
            className={`app-theme-box ${isLightMode ? "is-light" : "is-dark"}`}
            role="group"
            aria-label="Appearance"
          >
            {/* One thumb that travels between the halves rather than two fills swapping on
                and off — the movement is what tells you the two are the same control. */}
            <span className="app-theme-thumb" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={isLightMode ? "" : "is-active"}
              aria-pressed={!isLightMode}
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
        </div>

        <button type="button" onClick={handleLogout} className="app-drawer-logout liquid-press">
          <LuLogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </button>
      </aside>
    </div>
  );
}
