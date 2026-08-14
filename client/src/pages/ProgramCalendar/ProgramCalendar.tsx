import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import {
  AsyncSection,
  MoveProgramDayModal,
  NativeCard,
  NativePage,
  PageBody,
  PageIntro,
} from "@/shared/components";
import { MONTH_LABELS } from "@/shared/utils/monthGrid";
import "../Calendar/calendar.css";
import { ProgramCalendarGrid } from "./components/ProgramCalendarGrid";
import { ProgramDayDetail } from "./components/ProgramDayDetail";
import { useProgramCalendarPage } from "./hooks/useProgramCalendarPage";

export default function ProgramCalendar() {
  const { state, actions } = useProgramCalendarPage();

  return (
    <>
      <PageBody>
        <NativePage>
          <PageIntro
            eyebrow={state.plan?.name ?? "Program"}
            title="Schedule"
            action={
              <button type="button" onClick={actions.goToday} className="native-header-save">
                Today
              </button>
            }
          />

          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading calendar..."
          >
            <NativeCard className="cal-card">
              <div className="cal-head">
                <button type="button" onClick={actions.prevMonth} aria-label="Previous month">
                  <LuChevronLeft className="h-4 w-4" />
                </button>
                <div>
                  <span className="cal-head-year">{state.year}</span>
                  <b className="cal-head-month">{MONTH_LABELS[state.month - 1]}</b>
                </div>
                <button type="button" onClick={actions.nextMonth} aria-label="Next month">
                  <LuChevronRight className="h-4 w-4" />
                </button>
              </div>

              <ProgramCalendarGrid
                cells={state.cells}
                daysByKey={state.daysByKey}
                selectedKey={state.selectedKey}
                onSelectDay={actions.selectDay}
              />
            </NativeCard>

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
          </AsyncSection>
        </NativePage>
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
