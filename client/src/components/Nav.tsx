import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.svg";
import { isAdmin, useUserStore } from "@/stores/userStore";

function buildDisplayName(firstName?: string, lastName?: string): string {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ").trim();
}

function buildInitials(firstName?: string, lastName?: string, email?: string): string {
  const first = firstName?.trim() ?? "";
  const last = lastName?.trim() ?? "";

  if (first || last) {
    const firstInitial = first.charAt(0);
    const secondInitial = last.charAt(0) || first.charAt(1);
    const initials = `${firstInitial}${secondInitial}`.trim().toUpperCase();
    if (initials) {
      return initials;
    }
  }

  const prefix = (email ?? "").split("@")[0].replace(/[^A-Za-z0-9]/g, "");
  return prefix.slice(0, 2).toUpperCase() || "U";
}

export default function Nav() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const isInitialized = useUserStore((state) => state.isInitialized);
  const user = useUserStore((state) => state.user);
  const isAdminUser = useUserStore(isAdmin);
  const logout = useUserStore((state) => state.logout);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = () => {
    logout();
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

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 flex justify-center px-2 pt-3 md:px-4 md:pt-4">
      <div
        className={`liquid-surface liquid-nav flex items-center justify-between rounded-3xl px-4 py-3 md:px-5 w-4/5 ${
          isScrolled ? "is-scrolled" : "is-top"
        }`}
      >
        <Link to="/" className="flex items-center gap-2.5 text-lg font-extrabold text-slate-900 transition-opacity hover:opacity-80">
          <img src={logo} alt="FitMate" className="w-12 h-12" />
          <span>FitMate</span>
        </Link>

        {!isInitialized ? (
          <div className="text-sm text-slate-500">...</div>
        ) : isAuthenticated ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
              className="liquid-pill flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-slate-800"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="Open profile menu"
            >
              {initials}
            </button>

            {isMenuOpen && (
              <div className="liquid-surface absolute right-0 mt-5 w-48 rounded-2xl p-0" role="menu">
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
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-medium text-slate-800 hover:bg-white/45"
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setIsMenuOpen(false)}
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
