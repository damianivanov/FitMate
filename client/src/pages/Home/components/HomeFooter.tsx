import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { getCurrentYear } from "@/lib/helpers";
import { useConsentStore } from "@/stores/consentStore";

export default function HomeFooter() {
  const currentYear = getCurrentYear();
  const reopenBanner = useConsentStore((state) => state.reopenBanner);
  const isBannerOpen = useConsentStore((state) => state.isBannerOpen);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const root = document.documentElement;

    if (!isBannerOpen || !wrapper) {
      return;
    }

    const observer = new ResizeObserver(() => {
      root.style.setProperty(
        "--page-footer-height",
        `${wrapper.getBoundingClientRect().height}px`,
      );
    });
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
      root.style.removeProperty("--page-footer-height");
    };
  }, [isBannerOpen]);

  const wrapperClassName = isBannerOpen
    ? "fixed inset-x-0 bottom-0 z-[var(--z-nav)] px-4 pb-4"
    : "px-4 pb-4";

  return (
    <div ref={wrapperRef} className={wrapperClassName}>
      <div className="liquid-surface mx-auto flex w-full max-w-3xl flex-col items-center gap-3 rounded-3xl px-6 py-4 text-xs text-secondary sm:flex-row sm:justify-between">
        <span className="font-semibold text-foreground">
          Fit<span className="text-primary">Mate</span>
        </span>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link to="/legal#terms" className="liquid-link">
            Terms
          </Link>
          <Link to="/legal#privacy" className="liquid-link">
            Privacy
          </Link>
          <button type="button" onClick={reopenBanner} className="liquid-link">
            Cookie preferences
          </button>
        </div>

        <span>© {currentYear} FitMate. All rights reserved.</span>
      </div>
    </div>
  );
}
