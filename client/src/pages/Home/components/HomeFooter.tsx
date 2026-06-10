import { getCurrentYear } from "@/lib/helpers";

export default function HomeFooter() {
  const currentYear = getCurrentYear();

  return (
    <div className="px-4 pb-4">
      <div className="liquid-surface mx-auto flex w-full max-w-3xl justify-center items-center gap-3 rounded-3xl px-6 py-4 text-xs text-secondary sm:flex-row sm:justify-between">
        <span className="font-semibold text-foreground">
          Fit<span className="text-primary">Mate</span>
        </span>
        <span>© {currentYear} FitMate. All rights reserved.</span>
      </div>
    </div>
  );
}
