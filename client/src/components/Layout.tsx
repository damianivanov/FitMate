import { Outlet } from "react-router";
import { useConsentStore } from "@/stores/consentStore";
import { useUserStore } from "@/stores/userStore";
import { ActiveWorkoutSheetHost } from "./ActiveWorkoutSheetHost";
import AppNav from "./AppNav";
import CookieConsentBanner from "./CookieConsentBanner";

export default function Layout() {
  const { userLoaded, isAuthenticated } = useUserStore();
  const isBannerOpen = useConsentStore((state) => state.isBannerOpen);
  const isReadyAuthenticated = userLoaded && isAuthenticated;
  const bannerClearanceClassName = isBannerOpen ? "liquid-banner-clearance" : "";
  const publicShellClassName = isReadyAuthenticated ? "" : "liquid-public-shell";

  return (
    <div className="liquid-shell">
      {/* One scroll box at every width, with the header floating over it rather than
          stacked above it — that is what gives the blur lens live content to work on and
          lets a page's own large title hand its name up to the bar as it leaves. */}
      <div className="relative z-10 h-dvh min-h-0">
        <main
          data-app-scroll
          className={`liquid-main-shell liquid-app-scroll liquid-scrollbar flex h-full min-w-0 flex-col overflow-y-auto overscroll-contain ${publicShellClassName} ${bannerClearanceClassName}`}
        >
          <Outlet />
        </main>

        <AppNav />
      </div>

      {isReadyAuthenticated ? <ActiveWorkoutSheetHost /> : null}
      <CookieConsentBanner />
    </div>
  );
}
