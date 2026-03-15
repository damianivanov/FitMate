import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logo from "@/assets/logo.svg";
import { buildDisplayName, buildInitials } from "@/lib/helpers";
import { isAdmin, useUserStore } from "@/stores/userStore";

function getPrimaryNavLinkClassName({ isActive }: { isActive: boolean }): string {
  const baseClassName =
    "liquid-pill rounded-full px-3.5 py-2 text-sm font-semibold transition whitespace-nowrap";
  if (isActive) {
    return `${baseClassName} bg-white/80 text-slate-900 shadow-[0_10px_20px_rgba(42,78,120,0.2)]`;
  }

  return `${baseClassName} text-slate-700 hover:bg-white/70`;
}

export default function Nav() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const isInitialized = useUserStore((state) => state.isInitialized);
  const user = useUserStore((state) => state.user);
  const isAdminUser = useUserStore(isAdmin);
  const logout = useUserStore((state) => state.logout);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
  };

  const handleToggleMenu = () => {
    setIsMenuOpen((isOpen) => !isOpen);
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  const displayName = useMemo(
    () => buildDisplayName(user?.firstName, user?.lastName),
    [user?.firstName, user?.lastName],
  );

  const initials = useMemo(
    () => buildInitials(user?.firstName, user?.lastName, user?.email),
    [user?.firstName, user?.lastName, user?.email],
  );

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  return (
    <nav className="z-50 flex justify-center px-2 pt-3 md:px-4 md:pt-4">
      <div
        className="liquid-surface liquid-nav flex w-full max-w-6xl items-center justify-between rounded-3xl px-4 py-3 md:px-5"
      >
        <div className="flex items-center gap-2.5 md:gap-3">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-extrabold text-slate-900 transition-opacity hover:opacity-80">
            <img src={logo} alt="FitMate" className="w-12 h-12" />
            <span>FitMate</span>
          </Link>

          {isInitialized && isAuthenticated ? (
            <NavLink to="/workouts" end className={getPrimaryNavLinkClassName}>
              Workouts
            </NavLink>
          ) : null}
        </div>

        {!isInitialized ? (
          <div className="text-sm text-slate-500">...</div>
        ) : isAuthenticated ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={handleToggleMenu}
              className="liquid-pill flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-slate-800"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="Open profile menu"
            >
              {initials}
            </button>

            {isMenuOpen && (
              <div className="liquid-surface liquid-menu absolute right-0 mt-5 w-48 rounded-2xl p-0" role="menu">
                <div className="px-3 py-2 border-b border-white/30">
                  <p className="text-sm font-semibold text-slate-900">
                    {displayName || "No name set"}
                  </p>
                  <p className="text-xs text-slate-600">{user?.email}</p>
                </div>

                <div className="pt-0">
                  {isAdminUser && (
                    <Link
                      to="/management"
                      role="menuitem"
                      onClick={handleCloseMenu}
                      className="block px-4 py-2 text-sm font-medium text-slate-800 hover:bg-white/45"
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={handleCloseMenu}
                    className="block px-4 py-2 text-sm font-medium text-slate-800 hover:bg-white/45"
                  >
                    Profile
                  </Link>
                  <Link
                    to="/login"
                    role="menuitem"
                    onClick={handleLogout}
                    className="block w-full rounded-b-xl px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-white/45"
                  >
                    Logout
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="liquid-pill rounded-full px-3.5 py-2 text-sm font-semibold transition hover:bg-white/70">
              Login
            </Link>
            <Link to="/register" className="liquid-primary-btn rounded-full px-3.5 py-2 text-sm font-semibold">
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
