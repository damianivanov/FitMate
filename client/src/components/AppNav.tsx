import { Link, useLocation } from "react-router";
import { useNavDrawerStore } from "@/stores/navDrawerStore";
import { useUserStore } from "@/stores/userStore";
import AppHeader from "./AppHeader";
import AppLogo from "./AppLogo";
import MobileBottomNav from "./MobileBottomNav";
import NavigationDrawer from "./NavigationDrawer";

function PublicNav() {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/register";

  return (
    <nav className="flex justify-center px-4 pt-3 md:px-6 md:pt-4">
      <div className="liquid-surface liquid-nav flex w-full items-center justify-between rounded-3xl px-4 py-3 md:w-[75%] md:px-5">
        <AppLogo className="app-logo-lg" />
        {isAuthRoute ? null : (
          <Link
            to="/login"
            className="liquid-primary-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}

export default function AppNav() {
  const { userLoaded, isAuthenticated } = useUserStore();
  const closeDrawer = useNavDrawerStore((state) => state.close);

  if (!userLoaded) {
    return (
      <nav className="flex justify-center px-3 pt-3 md:px-6 md:pt-4">
        <div className="liquid-surface liquid-nav flex w-full items-center justify-between rounded-3xl px-4 py-3 md:w-[75%] md:px-5">
          <AppLogo className="app-logo-lg" />
          <span className="liquid-subtle-text text-sm font-medium">Loading...</span>
        </div>
      </nav>
    );
  }

  if (!isAuthenticated) {
    return <PublicNav />;
  }

  return (
    <>
      <AppHeader />
      <NavigationDrawer />
      <MobileBottomNav onNavigate={closeDrawer} />
    </>
  );
}
