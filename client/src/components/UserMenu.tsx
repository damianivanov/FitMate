import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LuLogOut, LuMenu, LuShield, LuUserRound } from "react-icons/lu";
import { buildDisplayName, buildInitials } from "@/lib/helpers";
import { isAdmin as hasAdminRole } from "@/lib/access";
import type { User } from "@/types";

type UserMenuProps = {
  user: User;
  onNavigate: () => void;
  onLogout: () => void;
  className?: string;
};

export default function UserMenu({
  user,
  onNavigate,
  onLogout,
  className = "",
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isAdminUser = hasAdminRole(user);
  const displayName = buildDisplayName(user.firstName, user.lastName) || "FitMate User";
  const initials = buildInitials(user.firstName, user.lastName, user.email);

  const handleToggleMenu = () => {
    setIsOpen((current) => !current);
  };

  const handleCloseMenu = () => {
    setIsOpen(false);
  };

  const handleProfileClick = () => {
    onNavigate();
    handleCloseMenu();
  };

  const handleAdminClick = () => {
    onNavigate();
    handleCloseMenu();
  };

  const handleLogoutClick = () => {
    onLogout();
    handleCloseMenu();
  };

  const menuIconClassName = "h-4 w-4 liquid-subtle-text";
  const containerBaseClassName = "relative";
  const containerClassName = `${containerBaseClassName} ${className}`.trim();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const eventTarget = event.target as Node;
      if (containerRef.current?.contains(eventTarget)) {
        return;
      }

      handleCloseMenu();
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseMenu();
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={containerClassName}>
      <button
        type="button"
        onClick={handleToggleMenu}
        className="liquid-pill flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-sky-500 to-emerald-500 text-xs font-bold text-white">
          {initials}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{displayName}</span>
        <LuMenu className={menuIconClassName} />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="liquid-menu liquid-user-menu absolute right-0 bottom-full left-0 z-30 mb-2 rounded-2xl p-1.5"
        >
          <div className="liquid-divider border-b px-3 py-2">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            {user.email ? <p className="truncate text-xs text-slate-600">{user.email}</p> : null}
          </div>

          <Link
            to="/profile"
            onClick={handleProfileClick}
            className="liquid-nav-item mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
            role="menuitem"
          >
            <LuUserRound className="h-4 w-4" />
            Profile
          </Link>

          {isAdminUser ? (
            <Link
              to="/management"
              onClick={handleAdminClick}
              className="liquid-nav-item flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
              role="menuitem"
            >
              <LuShield className="h-4 w-4" />
              Admin
            </Link>
          ) : null}

          <button
            type="button"
            onClick={handleLogoutClick}
            className="liquid-nav-item liquid-pill-danger flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium"
            role="menuitem"
          >
            <LuLogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
