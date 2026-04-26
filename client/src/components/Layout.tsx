import { Outlet } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import Sidebar from "./Sidebar";

export default function Layout() {
  const { userLoaded, isAuthenticated } = useUserStore();
  const isReadyAuthenticated = userLoaded && isAuthenticated;

  if (isReadyAuthenticated) {
    return (
      <div className="liquid-shell">
        <div className="relative z-10 flex h-full min-h-0 flex-col md:h-dvh md:min-h-dvh md:flex-row md:overflow-hidden">
          <Sidebar />
          <main className="liquid-main-shell liquid-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain md:h-dvh">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="liquid-shell">
      <div className="relative z-10 flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
