import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { AsyncSection, MoveProgramDayModal, PageBody, PageHeader } from "@/shared/components";
import { MONTH_LABELS } from "@/shared/utils/monthGrid";
import { ProgramCalendarGrid } from "./components/ProgramCalendarGrid";
import { ProgramDayDetail } from "./components/ProgramDayDetail";
import { useProgramCalendarPage } from "./hooks/useProgramCalendarPage";

export default function ProgramCalendar() {
  const { state, actions } = useProgramCalendarPage();

  return (
    <>
      <PageHeader
        title={state.plan?.name ?? "Program calendar"}
        subtitle={`${MONTH_LABELS[state.month - 1]} ${state.year}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={actions.prevMonth}
              aria-label="Previous month"
              className="liquid-pill cursor-pointer rounded-full p-2"
            >
              <LuChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={actions.goToday}
              className="liquid-pill cursor-pointer rounded-full px-3 py-2 text-xs font-semibold"
            >
              Today
            </button>
            <button
              type="button"
              onClick={actions.nextMonth}
              aria-label="Next month"
              className="liquid-pill cursor-pointer rounded-full p-2"
            >
              <LuChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          onRetry={actions.reload}
          loadingLabel="Loading calendar..."
        >
          <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <ProgramCalendarGrid
              cells={state.cells}
              daysByKey={state.daysByKey}
              selectedKey={state.selectedKey}
              onSelectDay={actions.selectDay}
            />
            <ProgramDayDetail
              days={state.selectedDays}
              busyDayId={state.busyDayId}
              startingDayId={state.startingDayId}
              onStart={(day) => void actions.start(day.id)}
              onMove={actions.requestMove}
              onSkip={(day) => void actions.skip(day)}
              onRestore={(day) => void actions.restore(day)}
              onOpenWorkout={actions.openWorkout}
            />
          </div>
        </AsyncSection>
      </PageBody>

      <MoveProgramDayModal
        isOpen={state.dayPendingMove !== null}
        day={state.dayPendingMove}
        minDate={state.plan?.startDate}
        maxDate={state.plan?.endDate ?? undefined}
        isMoving={state.isMoving}
        onCancel={actions.cancelMove}
        onConfirm={(newDate) => void actions.confirmMove(newDate)}
      />
    </>
  );
}
