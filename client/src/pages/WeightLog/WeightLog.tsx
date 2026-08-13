import { LuPlus, LuScale } from "react-icons/lu";
import { AsyncSection, DeleteConfirmationModal, LineChart, PageBody } from "@/shared/components";
import { ChartRangeControl } from "./components/ChartRangeControl";
import { LogWeightModal } from "./components/LogWeightModal";
import { MeasurementDetailModal } from "./components/MeasurementDetailModal";
import { WeightDial } from "./components/WeightDial";
import { WeightHistoryList } from "./components/WeightHistoryList";
import { formatSignedWeight, formatWeight } from "./formatting";
import { useWeightLogPage } from "./hooks/useWeightLogPage";
import "./weight-log.css";

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="wl-hero-stat min-w-0">
      <p className="wl-hero-stat-label">{label}</p>
      <p className="wl-hero-stat-value truncate">{value}</p>
    </div>
  );
}

export default function WeightLog() {
  const { state, actions } = useWeightLogPage();

  return (
    <>
      <PageBody>
        <div className="wl-body mx-auto w-full max-w-2xl">
          <header className="wl-nav">
            <div className="min-w-0">
              <p className="liquid-page-eyebrow">Your body</p>
              <h1 className="liquid-page-title">Progress</h1>
            </div>
          </header>

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
                <button
                  type="button"
                  onClick={actions.openLogModal}
                  className="liquid-primary-btn wl-hero-cta wl-empty-cta"
                >
                  <LuPlus className="h-4 w-4" />
                  <span>Log weight</span>
                </button>
              </div>
            }
          >
            <section className="wl-hero wl-materialize">
              <WeightDial
                value={state.latestWeight}
                low={state.overallStats.low}
                high={state.overallStats.high}
              />

              <button
                type="button"
                onClick={actions.openLogModal}
                className="liquid-primary-btn wl-hero-cta"
              >
                <LuPlus className="h-4 w-4" />
                <span>Log weight</span>
              </button>

              <div className="wl-hero-stats">
                <HeroStat label="Change" value={formatSignedWeight(state.overallStats.change)} />
                <HeroStat label="Lowest" value={formatWeight(state.overallStats.low)} />
                <HeroStat label="Highest" value={formatWeight(state.overallStats.high)} />
              </div>
            </section>

            <section className="liquid-panel wl-card">
              <div className="wl-card-head">
                <p className="wl-card-title">Weight trend</p>
                <ChartRangeControl value={state.range} onChange={actions.setRange} />
              </div>

              <div className="wl-chart">
                {state.chartPoints.length > 0 ? (
                  <LineChart points={state.chartPoints} valueSuffix=" kg" baseline="data" />
                ) : (
                  <p className="wl-chart-empty">Nothing logged in this range.</p>
                )}
              </div>
            </section>

            <section className="liquid-panel wl-card wl-card-flush">
              <div className="wl-card-head">
                <p className="wl-card-title">Measurements</p>
                <button type="button" className="wl-edit-btn" onClick={actions.toggleEditing}>
                  {state.isEditing ? "Done" : "Edit"}
                </button>
              </div>

              <WeightHistoryList
                rows={state.visibleRows}
                deletingId={state.deletingId}
                hasMore={state.hasMoreEntries}
                isEditing={state.isEditing}
                onLoadMore={actions.loadMore}
                onSelect={actions.selectEntry}
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

      <MeasurementDetailModal
        isOpen={state.isDetailOpen}
        entry={state.selectedEntry}
        deltaKg={state.selectedEntryDelta}
        onClose={actions.closeDetail}
        onDelete={() => {
          if (state.selectedEntry) {
            actions.requestDelete(state.selectedEntry);
          }
        }}
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
