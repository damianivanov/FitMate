import type { ReactNode } from "react";
import { LuRefreshCw } from "react-icons/lu";

type AsyncSectionProps = {
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  loadingLabel?: string;
  emptyState?: ReactNode;
  children: ReactNode;
};

export function AsyncSection({
  isLoading,
  error,
  onRetry,
  isEmpty = false,
  loadingLabel = "Loading...",
  emptyState,
  children,
}: AsyncSectionProps) {
  if (isLoading) {
    return (
      <div className="liquid-panel rounded-2xl px-5 py-8 text-center md:rounded-lg">
        <p className="text-sm font-semibold text-foreground">{loadingLabel}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="liquid-panel rounded-2xl px-5 py-8 text-center md:rounded-lg">
        <p className="text-sm font-semibold text-danger">{error ?? "Something went wrong."}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="liquid-pill mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
          >
            <LuRefreshCw className="h-4 w-4" />
            <span>Retry</span>
          </button>
        ) : null}
      </div>
    );
  }

  if (isEmpty && emptyState != null) {
    return <>{emptyState}</>;
  }

  return <>{children}</>;
}
