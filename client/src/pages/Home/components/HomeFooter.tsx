import { Link } from "react-router";
import { getCurrentYear } from "@/lib/helpers";
import { useConsentStore } from "@/stores/consentStore";

export default function HomeFooter() {
  const currentYear = getCurrentYear();
  const reopenBanner = useConsentStore((state) => state.reopenBanner);

  return (
    <div className="px-4 pb-4">
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
