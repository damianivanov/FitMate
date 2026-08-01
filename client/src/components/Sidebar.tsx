import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { LuMenu, LuPlus, LuX } from "react-icons/lu";
import { isAdmin as hasAdminRole } from "@/lib/access";
import { useUserStore } from "@/stores/userStore";
import MobileBottomNav from "./MobileBottomNav";
import { navSections } from "./navigation";
import UserMenu from "./UserMenu";

function getPrimaryItemClassName(isActive: boolean): string {
  const baseClassName =
    "liquid-nav-item flex w-full items-center gap-3.5 rounded-full border border-transparent px-4 py-3 text-left text-sm transition";
  const stateClassName = isActive
    ? "liquid-nav-item-active font-semibold"
    : "font-medium";

  return `${baseClassName} ${stateClassName}`;
}

const iconButtonClassName =
  "liquid-pill inline-flex h-11 w-11 items-center justify-center rounded-full transition";

const sectionLabelClassName =
  "px-4 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-tertiary";

type PrimaryNavItemsProps = {
  isAdminUser: boolean;
  onNavigate: () => void;
};

function PrimaryNavItems({ isAdminUser, onNavigate }: PrimaryNavItemsProps) {
  return (
    <nav aria-label="Sections" className="space-y-6">
      {navSections.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.requiresAdmin || isAdminUser,
        );

        if (visibleItems.length === 0) {
          return null;
        }

        return (
          <div key={section.section}>
            <p className={sectionLabelClassName}>{section.section}</p>
            <div className="mt-2 space-y-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) => getPrimaryItemClassName(isActive)}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function AppLogo() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">
          Fit<span className="text-primary ps-0.5">Mate</span>
        </p>
      </div>
    </Link>
  );
}

function StartWorkoutButton() {
  return (
    <Link
      to="/workouts/new"
      className="liquid-primary-btn inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
    >
      <LuPlus className="h-4 w-4" />
      Start workout
    </Link>
  );
}

function AuthenticatedNav() {
  const { user, logout } = useUserStore();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isAdminUser = hasAdminRole(user);

  const handleOpenMobile = () => {
    setIsMobileOpen(true);
  };

  const handleCloseMobile = () => {
    setIsMobileOpen(false);
  };

  const handleNavigate = () => {
    setIsMobileOpen(false);
  };

  const handleLogout = () => {
    void logout();
    setIsMobileOpen(false);
  };

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileOpen]);

  return (
    <>
      <aside className="hidden h-full md:block md:h-dvh md:w-64">
        <div className="liquid-sidebar-panel h-full px-3 py-6">
          <div className="relative z-10 flex h-full flex-col">
            <AppLogo />

            <div className="mt-6">
              <StartWorkoutButton />
            </div>

            <div className="liquid-scrollbar mt-6 min-h-0 flex-1 overflow-y-auto">
              <PrimaryNavItems isAdminUser={isAdminUser} onNavigate={handleNavigate} />
            </div>

            <div className="mt-4">
              <UserMenu user={user} onNavigate={handleNavigate} onLogout={handleLogout} />
            </div>
          </div>
        </div>
      </aside>

      <header className="liquid-mobile-header px-4 py-3 md:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <AppLogo />
          <button
            type="button"
            onClick={handleOpenMobile}
            className={iconButtonClassName}
            aria-label="Open navigation"
            aria-expanded={isMobileOpen}
          >
            <LuMenu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {isMobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="liquid-overlay-strong absolute inset-0"
            onClick={handleCloseMobile}
            aria-label="Close navigation overlay"
          />
          <aside
            aria-label="All pages"
            className="liquid-sidebar-panel relative h-full w-[84vw] max-w-sm p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
          >
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-center justify-between">
                <AppLogo />
                <button
                  type="button"
                  onClick={handleCloseMobile}
                  className={iconButtonClassName}
                  aria-label="Close navigation"
                >
                  <LuX className="h-5 w-5" />
                </button>
              </div>

              <div className="liquid-scrollbar mt-6 min-h-0 flex-1 overflow-y-auto">
                <PrimaryNavItems isAdminUser={isAdminUser} onNavigate={handleNavigate} />
              </div>

              <div className="mt-4">
                <UserMenu
                  user={user}
                  onNavigate={handleNavigate}
                  onLogout={handleLogout}
                />
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <MobileBottomNav onNavigate={handleNavigate} />
    </>
  );
}

function PublicNav() {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/register";

  return (
    <nav className="flex justify-center px-4 pt-3 md:px-6 md:pt-4">
      <div className="liquid-surface liquid-nav flex w-full items-center justify-between rounded-3xl px-4 py-3 md:w-[75%] md:px-5">
        <AppLogo />
        {isAuthRoute ? null : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="liquid-primary-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold"
            >
              Login
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

export default function Sidebar() {
  const { userLoaded, isAuthenticated } = useUserStore();

  if (!userLoaded) {
    return (
      <nav className="flex justify-center px-3 pt-3 md:px-6 md:pt-4">
        <div className="liquid-surface liquid-nav flex w-full items-center justify-between rounded-3xl px-4 py-3 md:w-[75%] md:px-5">
          <AppLogo />
          <span className="liquid-subtle-text text-sm font-medium">Loading...</span>
        </div>
      </nav>
    );
  }

  if (!isAuthenticated) {
    return <PublicNav />;
  }

  return <AuthenticatedNav />;
}
