import { Outlet } from "react-router";
import { useConsentStore } from "@/stores/consentStore";
import { useUserStore } from "@/stores/userStore";
import { ActiveWorkoutSheetHost } from "./ActiveWorkoutSheetHost";
import CookieConsentBanner from "./CookieConsentBanner";
import Sidebar from "./Sidebar";

export default function Layout() {
  const { userLoaded, isAuthenticated } = useUserStore();
  const isBannerOpen = useConsentStore((state) => state.isBannerOpen);
  const isReadyAuthenticated = userLoaded && isAuthenticated;
  const bannerClearanceClassName = isBannerOpen ? "liquid-banner-clearance" : "";

  if (isReadyAuthenticated) {
    return (
      <div className="liquid-shell">
        <div className="pwa-safe-top relative z-10 flex h-full min-h-0 flex-col md:h-dvh md:min-h-dvh md:flex-row md:overflow-hidden">
          <Sidebar />
          <main className={`liquid-main-shell liquid-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain md:h-dvh ${bannerClearanceClassName}`}>
            <Outlet />
          </main>
        </div>
        <ActiveWorkoutSheetHost />
        <CookieConsentBanner />
      </div>
    );
  }

  return (
    <div className="liquid-shell">
      <div className={`pwa-safe-top relative z-10 flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain ${bannerClearanceClassName}`}>
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      <CookieConsentBanner />
    </div>
  );
}
