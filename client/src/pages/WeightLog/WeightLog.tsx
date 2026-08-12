import { useEffect, useRef, useState } from "react";
import { LuArrowDown, LuArrowUp, LuMinus, LuPlus, LuScale } from "react-icons/lu";
import { formatNumber, normalizeUtcIsoString } from "@/lib/helpers";
import { AsyncSection, DeleteConfirmationModal, LineChart, PageBody } from "@/shared/components";
import { ChartRangeControl } from "./components/ChartRangeControl";
import { LogWeightModal } from "./components/LogWeightModal";
import { WeightHistoryList } from "./components/WeightHistoryList";
import { useWeightLogPage } from "./hooks/useWeightLogPage";
import "./weight-log.css";

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

function formatWeight(value: number | null): string {
  return value != null ? `${formatNumber(value, 1)} kg` : "—";
}

function formatSignedWeight(value: number | null): string {
  if (value == null) {
    return "—";
  }

  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value), 1)} kg`;
}

function formatLoggedDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? null : SHORT_DATE_FORMATTER.format(date);
}

function DeltaChip({ value }: { value: number | null }) {
  if (value == null) {
    return null;
  }

  const Icon = value > 0 ? LuArrowUp : value < 0 ? LuArrowDown : LuMinus;

  return (
    <span className="liquid-chip wl-delta">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {formatSignedWeight(value)}
      <span className="sr-only"> since the previous entry</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="wl-stat min-w-0">
      <p className="wl-stat-label">{label}</p>
      <p className="wl-stat-value truncate">{value}</p>
    </div>
  );
}

export default function WeightLog() {
  const { state, actions } = useWeightLogPage();
  const topbarRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Which element scrolls depends on the breakpoint, so measure the two edges against each
  // other instead of binding to one container.
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const topbar = topbarRef.current;
      const sentinel = sentinelRef.current;
      if (!topbar || !sentinel) {
        return;
      }

      setIsScrolled(sentinel.getBoundingClientRect().top < topbar.getBoundingClientRect().bottom);
    };

    const schedule = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(measure);
      }
    };

    measure();
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const latestDate = formatLoggedDate(state.latestLoggedAt);
  const caption = [
    state.latestBodyFat != null ? `${formatNumber(state.latestBodyFat, 1)}% body fat` : null,
    latestDate ? `Logged ${latestDate}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <header
        ref={topbarRef}
        className="liquid-chrome-bar wl-topbar"
        data-scrolled={isScrolled}
      >
        <div>
          <p className="wl-eyebrow">Body</p>
          <h1 className="wl-title">Weight</h1>
        </div>

        <button
          type="button"
          onClick={actions.openLogModal}
          className="liquid-primary-btn inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <LuPlus className="h-4 w-4" />
          <span>Log weight</span>
        </button>
      </header>

      <PageBody>
        <div ref={sentinelRef} className="wl-sentinel" aria-hidden="true" />

        <div className="wl-body mx-auto w-full max-w-2xl">
          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading weight history..."
            isEmpty={state.entryCount === 0}
            emptyState={
              <div className="liquid-panel wl-empty">
                <LuScale className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
                <p className="wl-empty-title">No entries yet</p>
                <p className="wl-empty-body">
                  Log your weight to start tracking progress. One number a week is enough to see a
                  trend.
                </p>
              </div>
            }
          >
            <section className="wl-hero wl-materialize">
              <p className="wl-eyebrow">Current</p>
              <p className="wl-hero-value">
                <span className="wl-hero-number">
                  {state.latestWeight != null ? formatNumber(state.latestWeight, 1) : "—"}
                </span>
                <span className="wl-hero-unit">kg</span>
              </p>
              <div className="wl-hero-meta">
                <DeltaChip value={state.weightChange} />
                {caption ? <p className="wl-hero-caption">{caption}</p> : null}
              </div>
            </section>

            <section className="liquid-panel wl-card">
              <div className="wl-card-head">
                <p className="wl-card-title">Trend</p>
                <ChartRangeControl value={state.range} onChange={actions.setRange} />
              </div>

              <div className="wl-chart">
                {state.chartPoints.length > 0 ? (
                  <LineChart points={state.chartPoints} valueSuffix=" kg" baseline="data" />
                ) : (
                  <p className="wl-chart-empty">Nothing logged in this range.</p>
                )}
              </div>

              <div className="wl-stats">
                <Stat label="Change" value={formatSignedWeight(state.rangeStats.change)} />
                <Stat label="Lowest" value={formatWeight(state.rangeStats.low)} />
                <Stat label="Highest" value={formatWeight(state.rangeStats.high)} />
              </div>
            </section>

            <section className="liquid-panel wl-card wl-card-flush">
              <div className="wl-card-head">
                <p className="wl-card-title">History</p>
                <p className="wl-card-note">
                  {state.entryCount} {state.entryCount === 1 ? "entry" : "entries"} · swipe a row to
                  delete
                </p>
              </div>

              <WeightHistoryList
                entries={state.visibleEntries}
                deletingId={state.deletingId}
                hasMore={state.hasMoreEntries}
                onLoadMore={actions.loadMore}
                onDelete={actions.requestDelete}
              />
            </section>
          </AsyncSection>
        </div>
      </PageBody>

      <LogWeightModal
        isOpen={state.isLogModalOpen}
        weightKg={state.weightKg}
        bodyFat={state.bodyFat}
        note={state.note}
        isLogging={state.isLogging}
        onWeightChange={actions.setWeightKg}
        onBodyFatChange={actions.setBodyFat}
        onNoteChange={actions.setNote}
        onSave={actions.log}
        onClose={actions.closeLogModal}
      />

      <DeleteConfirmationModal
        isOpen={state.isDeleteConfirmationOpen}
        itemName={state.entryPendingDeleteLabel}
        title="Delete entry"
        isDeleting={state.deletingId !== null}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
