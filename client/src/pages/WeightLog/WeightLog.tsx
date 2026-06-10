import { LuScale } from "react-icons/lu";
import { formatNumber } from "@/lib/helpers";
import {
  AsyncSection,
  DeleteConfirmationModal,
  LineChart,
  PageBody,
  PageHeader,
  StatTile,
} from "@/shared/components";
import { QuickLogCard } from "./components/QuickLogCard";
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

export default function WeightLog() {
  const { state, actions } = useWeightLogPage();

  return (
    <>
      <PageHeader
        title="Weight"
        subtitle={`${state.entryCount} entr${state.entryCount === 1 ? "y" : "ies"}`}
      />

      <PageBody>
        <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[360px_1fr] lg:items-start">
          <QuickLogCard
            weightKg={state.weightKg}
            bodyFat={state.bodyFat}
            note={state.note}
            isLogging={state.isLogging}
            onWeightChange={actions.setWeightKg}
            onBodyFatChange={actions.setBodyFat}
            onNoteChange={actions.setNote}
            onLog={actions.log}
          />

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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Latest" value={formatWeight(state.latestWeight)} />
                <StatTile label="Change" value={formatChange(state.weightChange)} />
                <StatTile label="Body fat" value={formatBodyFat(state.latestBodyFat)} />
                <StatTile label="Entries" value={String(state.entryCount)} />
              </div>

              <div className="liquid-panel rounded-2xl p-4 md:rounded-lg">
                <h2 className="mb-3 text-sm font-semibold text-secondary">Weight trend</h2>
                <LineChart points={state.chartPoints} valueSuffix=" kg" emptyText="No weight data yet." />
              </div>

              <WeightHistoryList
                entries={state.entries}
                deletingId={state.deletingId}
                onDelete={actions.requestDelete}
              />
            </div>
          </AsyncSection>
        </div>
      </PageBody>

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
