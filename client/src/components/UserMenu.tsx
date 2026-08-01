import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { LuCookie, LuLogOut, LuMenu, LuMoon, LuScale, LuSun } from "react-icons/lu";
import { buildDisplayName, buildInitials, getAvatarColorClassName } from "@/lib/helpers";
import { useConsentStore } from "@/stores/consentStore";
import { useThemeStore } from "@/stores/themeStore";
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

  const { theme, toggleTheme } = useThemeStore();
  const reopenBanner = useConsentStore((state) => state.reopenBanner);
  const isLightMode = theme === "light";
  const displayName = buildDisplayName(user.firstName, user.lastName) || user.email;
  const initials = buildInitials(user.firstName, user.lastName, user.email);
  const avatarColorClassName = getAvatarColorClassName(user.id);
  const sunToggleIconClassName = isLightMode ? "h-4 w-4 text-orange-600" : "h-4 w-4 text-orange-400/85";
  const moonToggleIconClassName = isLightMode ? "h-4 w-4 text-sky-400/85" : "h-4 w-4 text-sky-600";

  const handleToggleMenu = () => {
    setIsOpen((current) => !current);
  };

  const handleCloseMenu = () => {
    setIsOpen(false);
  };

  const handleLogoutClick = () => {
    onLogout();
    handleCloseMenu();
  };

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const handleLegalClick = () => {
    onNavigate();
    handleCloseMenu();
  };

  const handleCookiePreferencesClick = () => {
    reopenBanner();
    handleCloseMenu();
  };

  const menuIconClassName = "h-5 w-5 text-slate-500 dark:text-slate-400";
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
        className="liquid-pill flex w-full items-center gap-3 rounded-full px-3.5 py-2 text-left"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${avatarColorClassName}`}>
          {initials}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold text-slate-800 dark:text-slate-100">
          {displayName}
        </span>
        <LuMenu className={menuIconClassName} />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="liquid-menu liquid-user-menu absolute right-0 bottom-full left-0 z-30 mb-2 rounded-2xl p-1.5"
        >
          <div className="liquid-divider border-b px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{displayName}</p>
              {user.email && user.email !== displayName ? (
                <p className="truncate text-xs text-tertiary">{user.email}</p>
              ) : null}
            </div>
          </div>

          <Link
            to="/legal"
            onClick={handleLegalClick}
            className="liquid-nav-item mt-1 flex items-center gap-2.5 rounded-full px-3 py-2.5 text-sm font-medium"
            role="menuitem"
          >
            <LuScale className="h-4 w-4" />
            Legal
          </Link>

          <button
            type="button"
            onClick={handleCookiePreferencesClick}
            className="liquid-nav-item flex w-full items-center gap-2.5 rounded-full px-3 py-2.5 text-left text-sm font-medium"
            role="menuitem"
          >
            <LuCookie className="h-4 w-4" />
            Cookie preferences
          </button>

          <div className="liquid-divider mt-1 border-t px-1 pt-1">
            <div className="flex items-center justify-between px-3 py-2.5 text-sm font-medium">
              <span className="flex items-center gap-2.5">
                <span className="text-secondary">Theme</span>
              </span>
              <div className="flex items-center gap-2.5">
                <LuMoon className={moonToggleIconClassName} aria-hidden="true" />
                <button
                  type="button"
                  onClick={handleThemeToggle}
                  className={`liquid-theme-switch ${isLightMode ? "liquid-theme-switch-active" : ""}`}
                  role="menuitemcheckbox"
                  aria-checked={isLightMode}
                  aria-label={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
                >
                  <span className="liquid-theme-switch-knob" />
                </button>
                <LuSun className={sunToggleIconClassName} aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className="liquid-divider mt-1 border-t px-1 pt-1">
            <button
              type="button"
              onClick={handleLogoutClick}
              className="liquid-nav-item liquid-pill-danger flex w-full items-center gap-2.5 rounded-full px-3 py-2.5 text-left text-sm font-medium"
              role="menuitem"
            >
              <LuLogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
