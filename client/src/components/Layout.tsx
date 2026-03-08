import { Outlet } from "react-router-dom";
import Nav from "./Nav";

export default function Layout() {
  return (
    <div className="liquid-page min-h-screen flex flex-col text-slate-900">
      <Nav />
      <main className="w-full flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
