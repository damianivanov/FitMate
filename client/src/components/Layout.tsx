import { Outlet } from "react-router-dom";
import { useUserStore } from "@/stores/userStore";
import Sidebar from "./Sidebar";

export default function Layout() {
  const { userLoaded, isAuthenticated } = useUserStore();
  const isReadyAuthenticated = userLoaded && isAuthenticated;
  const shellClassName = isReadyAuthenticated
    ? "relative flex min-h-screen flex-col md:h-[100dvh] md:min-h-0 md:flex-row md:overflow-hidden"
    : "relative flex min-h-screen flex-col";
  const mainClassName = isReadyAuthenticated
    ? "flex min-w-0 flex-1 flex-col min-h-0 md:h-[100dvh] md:overflow-y-auto md:overscroll-contain"
    : "flex min-w-0 flex-1 flex-col min-h-0";

  return (
    <div className="liquid-shell">
      <div className="liquid-shell-orb liquid-shell-orb-a" />
      <div className="liquid-shell-orb liquid-shell-orb-b" />
      <div className="liquid-shell-orb liquid-shell-orb-c" />
      <div className="liquid-shell-orb liquid-shell-orb-d" />
      <div className="liquid-shell-orb liquid-shell-orb-e" />
      <div className="liquid-shell-gloss" />

      <div className={shellClassName}>
        <Sidebar />
        <main className={mainClassName}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
