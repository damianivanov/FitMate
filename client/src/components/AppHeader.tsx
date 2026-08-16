import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import {
  selectIsActiveWorkout,
  useActiveWorkoutStore,
} from "@/stores/activeWorkoutStore";
import { selectIsNavDrawerOpen, useNavDrawerStore } from "@/stores/navDrawerStore";
import AppLogo from "./AppLogo";
import MenuToggleIcon from "./MenuToggleIcon";
import { resolveRouteTitle } from "./navigation";

/** Roughly the height of a page's own large title: the wordmark hands over as it leaves. */
const COMPACT_SCROLL_THRESHOLD = 64;

export default function AppHeader() {
  const isDrawerOpen = useNavDrawerStore(selectIsNavDrawerOpen);
  const openDrawer = useNavDrawerStore((state) => state.open);
  const closeDrawer = useNavDrawerStore((state) => state.close);
  const isWorkoutActive = useActiveWorkoutStore(selectIsActiveWorkout);
  const { pathname } = useLocation();
  // Stored as the route that is scrolled rather than a bare flag: a new route starts at the
  // top of its own scroll box and fires no scroll event, so a flag would stay stuck on the
  // outgoing page's title.
  const [scrolledPathname, setScrolledPathname] = useState<string | null>(null);

  const isCompact = scrolledPathname === pathname;
  const title = resolveRouteTitle(pathname);

  const handleNavigationToggle = () => {
    if (isDrawerOpen) {
      closeDrawer();
      return;
    }

    openDrawer();
  };

  useEffect(() => {
    // Scroll events do not bubble, so the app's scroll container is picked up in the capture
    // phase instead of being threaded down as a ref. The data attribute is what keeps a
    // page's own inner scroller (a chart strip, a table) from driving the header.
    const handleScroll = (event: Event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement) || target.dataset.appScroll === undefined) {
        return;
      }

      setScrolledPathname(target.scrollTop > COMPACT_SCROLL_THRESHOLD ? pathname : null);
    };

    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    return () => document.removeEventListener("scroll", handleScroll, { capture: true });
  }, [pathname]);

  return (
    <header className="app-header app-header-authenticated">
      {/* The graduated blur strip. Sibling of the header's content rather than its background,
          so content dissolving under the bar never touches the controls sitting on it. */}
      <span className="liquid-lens app-header-lens" aria-hidden="true" />

      <button
        type="button"
        onClick={handleNavigationToggle}
        className="app-header-orb app-menu-toggle liquid-press"
        aria-label={isDrawerOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isDrawerOpen}
      >
        <MenuToggleIcon isOpen={isDrawerOpen} />
        {isWorkoutActive ? <i className="app-header-orb-dot" aria-hidden="true" /> : null}
      </button>

      <div className={`app-header-center ${isCompact && title ? "is-compact" : ""}`}>
        <AppLogo />
        <b>{title}</b>
      </div>
    </header>
  );
}
