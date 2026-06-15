import { LuPlus, LuScale } from "react-icons/lu";
import { formatNumber } from "@/lib/helpers";
import {
  AsyncSection,
  DeleteConfirmationModal,
  LineChart,
  PageBody,
} from "@/shared/components";
import { LogWeightModal } from "./components/LogWeightModal";
import { WeightHistoryList } from "./components/WeightHistoryList";
import { useWeightLogPage } from "./hooks/useWeightLogPage";

function formatWeight(value: number | null): string {
  return value != null ? `${formatNumber(value, 1)} kg` : "—";
}

function formatChange(value: number | null): string {
  if (value == null) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)} kg`;
}

function formatBodyFat(value: number | null): string {
  return value != null ? `${formatNumber(value, 1)}%` : "—";
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-2xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-0.5 truncate text-base font-bold text-foreground">{value}</p>
    </div>
  );
}

export default function WeightLog() {
  const { state, actions } = useWeightLogPage();

  return (
    <>
      <header className="flex items-center justify-end px-4 py-3 md:px-8">
        <button
          type="button"
          onClick={actions.openLogModal}
          className="liquid-primary-btn inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold sm:w-auto"
        >
          <LuPlus className="h-4 w-4" />
          <span>Log weight</span>
        </button>
      </header>

      <PageBody>
        <div className="mx-auto max-w-2xl space-y-5">
          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading weight history..."
            isEmpty={state.entryCount === 0}
            emptyState={
              <div className="liquid-panel rounded-2xl px-5 py-10 text-center md:rounded-lg">
                <LuScale className="mx-auto h-8 w-8 text-secondary" />
                <p className="mt-3 text-base font-bold text-foreground">No entries yet</p>
                <p className="mt-1 text-sm text-secondary">Log your weight to start tracking progress.</p>
              </div>
            }
          >
            <div className="space-y-5">
              <div className="liquid-panel rounded-2xl p-4 md:rounded-lg">
                <LineChart points={state.chartPoints} valueSuffix=" kg" emptyText="No weight data yet." />
              </div>

              <div className="flex flex-wrap items-start gap-x-8 gap-y-3 px-1">
                <MiniStat label="Latest" value={formatWeight(state.latestWeight)} />
                <MiniStat label="Change" value={formatChange(state.weightChange)} />
                <MiniStat label="Body fat" value={formatBodyFat(state.latestBodyFat)} />
                <MiniStat label="Entries" value={String(state.entryCount)} />
              </div>

              <WeightHistoryList
                entries={state.visibleEntries}
                deletingId={state.deletingId}
                hasMore={state.hasMoreEntries}
                onLoadMore={actions.loadMore}
                onDelete={actions.requestDelete}
              />
            </div>
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
