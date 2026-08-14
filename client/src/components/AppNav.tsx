import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useNavDrawerStore } from "@/stores/navDrawerStore";
import { useUserStore } from "@/stores/userStore";
import AppHeader from "./AppHeader";
import AppLogo from "./AppLogo";
import MobileBottomNav from "./MobileBottomNav";
import NavigationDrawer from "./NavigationDrawer";

/** The signed-in header minus the state it has no owner for: same bar, same lens, same box. */
function PublicHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="app-header app-header-public">
      <span className="liquid-lens app-header-lens" aria-hidden="true" />

      <div className="app-header-center">
        <AppLogo />
      </div>

      <div className="app-header-actions">{children}</div>
    </header>
  );
}

export default function AppNav() {
  const { userLoaded, isAuthenticated } = useUserStore();
  const closeDrawer = useNavDrawerStore((state) => state.close);
  const { pathname } = useLocation();

  if (!userLoaded) {
    return (
      <PublicHeader>
        <span className="liquid-subtle-text text-sm font-medium">Loading...</span>
      </PublicHeader>
    );
  }

  if (!isAuthenticated) {
    const isAuthRoute = pathname === "/login" || pathname === "/register";

    return (
      <PublicHeader>
        {isAuthRoute ? null : (
          <Link
            to="/login"
            className="liquid-primary-btn liquid-press inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold"
          >
            Login
          </Link>
        )}
      </PublicHeader>
    );
  }

  return (
    <>
      <AppHeader />
      <NavigationDrawer />
      <MobileBottomNav onNavigate={closeDrawer} />
    </>
  );
}
