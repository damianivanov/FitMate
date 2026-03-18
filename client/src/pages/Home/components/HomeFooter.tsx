import { getCurrentYear } from "@/lib/helpers";

export default function HomeFooter() {
  const currentYear = getCurrentYear();

  return (
    <div className="px-4 pb-4">
      <div className="liquid-surface mx-auto flex w-full max-w-3xl justify-center rounded-full px-6 py-3 text-xs text-secondary">
        <div className="text-center">(c) {currentYear} FitMate. All rights reserved.</div>
      </div>
    </div>
  );
}

