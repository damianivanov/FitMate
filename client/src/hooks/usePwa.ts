import { useCallback, useSyncExternalStore } from "react";

/**
 * Detects whether the app is running as an installed PWA (standalone display
 * mode) rather than inside a normal browser tab, and reflects that on the
 * document root via the `pwa-standalone` class so CSS can adapt (e.g. extend
 * the top bar into the status-bar safe area, lift the bottom nav).
 */

const DISPLAY_MODE_QUERIES = [
  "(display-mode: standalone)",
  "(display-mode: fullscreen)",
  "(display-mode: minimal-ui)",
] as const;

const PWA_CLASS = "pwa-standalone";

type IosNavigator = Navigator & { standalone?: boolean };

function detectStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const matchesDisplayMode =
    typeof window.matchMedia === "function" &&
    DISPLAY_MODE_QUERIES.some((query) => window.matchMedia(query).matches);

  // iOS Safari (legacy, pre display-mode support) exposes navigator.standalone.
  const isIosStandalone = (window.navigator as IosNavigator).standalone === true;

  return matchesDisplayMode || isIosStandalone;
}

/**
 * Toggles the `pwa-standalone` class on <html>. Call once on startup (before
 * first paint) to avoid a flash, then again whenever the display mode changes.
 */
export function applyPwaDisplayModeClass(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle(PWA_CLASS, detectStandalone());
}

function subscribeToDisplayMode(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQueryLists = DISPLAY_MODE_QUERIES.map((query) => window.matchMedia(query));
  const handleChange = () => {
    applyPwaDisplayModeClass();
    onStoreChange();
  };

  mediaQueryLists.forEach((mediaQueryList) => {
    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);
    } else {
      mediaQueryList.addListener(handleChange);
    }
  });

  return () => {
    mediaQueryLists.forEach((mediaQueryList) => {
      if (typeof mediaQueryList.removeEventListener === "function") {
        mediaQueryList.removeEventListener("change", handleChange);
      } else {
        mediaQueryList.removeListener(handleChange);
      }
    });
  };
}

export function useIsPwa(): boolean {
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribeToDisplayMode, detectStandalone, getServerSnapshot);
}
