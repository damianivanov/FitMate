import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import type { IconType } from "react-icons";
import { LuBookCopy, LuClock3, LuDumbbell, LuLayoutDashboard, LuMenu, LuX } from "react-icons/lu";
import logo from "@/assets/logo.png";
import { isAdmin as hasAdminRole } from "@/lib/access";
import { useUserStore } from "@/stores/userStore";
import UserMenu from "./UserMenu";

type NavItem = {
  label: string;
  to: string;
  icon: IconType;
  end?: boolean;
  requiresAdmin?: boolean;
};

type NavSection = {
  section: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    section: "Training",
    items: [
      { label: "Workouts", to: "/workouts", icon: LuDumbbell, end: false },
      { label: "Templates", to: "/templates", icon: LuBookCopy, end: false },
      { label: "History", to: "/workouts/history", icon: LuClock3, end: false },
    ],
  },
  {
    section: "Progress",
    items: [
      { label: "Analytics", to: "/analytics", icon: LuLayoutDashboard, end: false },
      { label: "Records", to: "/records", icon: LuLayoutDashboard, end: false },
    ],
  },
];

function getPrimaryItemClassName(isActive: boolean): string {
  const baseClassName =
    "liquid-nav-item flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition";
  const stateClassName = isActive
    ? "liquid-nav-item-active font-semibold"
    : "font-medium";

  return `${baseClassName} ${stateClassName}`;
}

function getPublicNavItemClassName(isActive: boolean): string {
  const baseClassName =
    "liquid-pill rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition";
  const stateClassName = isActive
    ? "liquid-pill-active text-primary"
    : "text-secondary";

  return `${baseClassName} ${stateClassName}`;
}

const publicRegisterClassName =
  "liquid-primary-btn rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap";

const iconButtonClassName =
  "liquid-icon-btn inline-flex h-10 w-10 items-center justify-center rounded-lg transition";

type PrimaryNavItemsProps = {
  isAdminUser: boolean;
  onNavigate: () => void;
};

function PrimaryNavItems({ isAdminUser, onNavigate }: PrimaryNavItemsProps) {
  return (
    <div className="space-y-3">
      {navSections.map((section) => (
        <section key={section.section}>
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            {section.section}
          </p>
          <div className="mt-2 space-y-2">
            {section.items
              .filter((item) => !item.requiresAdmin || (item.requiresAdmin && isAdminUser))
              .map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) => getPrimaryItemClassName(isActive)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-2xl px-1 py-1 transition hover:opacity-90"
    >
      <img src={logo} alt="FitMate" className="h-10 w-10 rounded-lg object-cover shadow-md" />
      <span className="text-lg font-extrabold tracking-tight text-primary">FitMate</span>
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

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileOpen]);

  return (
    <>
      <aside className="hidden md:block md:h-dvh md:w-64 md:shrink-0 md:overflow-hidden">
        <div className="liquid-sidebar relative h-full overflow-hidden p-3 pt-7">
          <Brand />
          <div className="mt-8 pb-24">
            <PrimaryNavItems isAdminUser={isAdminUser} onNavigate={handleNavigate} />
          </div>
          <div className="absolute inset-x-0 bottom-0 w-full p-3">
            <UserMenu
              user={user}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </aside>

      <header className="liquid-mobile-header px-4 py-3 md:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <Brand />
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
          <aside className="liquid-panel liquid-divider relative h-full w-[82vw] max-w-sm border-r p-4">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={handleCloseMobile}
                className={iconButtonClassName}
                aria-label="Close navigation"
              >
                <LuX className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex h-[calc(100%-4rem)] flex-col overflow-y-auto overflow-x-visible">
              <PrimaryNavItems isAdminUser={isAdminUser} onNavigate={handleNavigate} />
              <UserMenu
                user={user}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                className="mt-4"
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function PublicNav() {
  return (
    <nav className="flex justify-center px-3 pt-3 md:px-6 md:pt-4">
      <div className="liquid-surface liquid-nav flex w-full items-center justify-between rounded-3xl px-4 py-3 md:w-[75%] md:px-5">
        <Brand />
        <div className="flex items-center gap-2">
          <NavLink to="/login" className={({ isActive }) => getPublicNavItemClassName(isActive)}>
            Login
          </NavLink>
          <Link to="/register" className={publicRegisterClassName}>
            Register
          </Link>
        </div>
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
          <Brand />
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

