import { LuChevronDown, LuChevronLeft, LuChevronRight, LuFlame } from "react-icons/lu";
import { AsyncSection, PageBody, PageHeader } from "@/shared/components";
import { CalendarDayDetail } from "./components/CalendarDayDetail";
import { CalendarGrid } from "./components/CalendarGrid";
import { MonthPickerModal } from "./components/MonthPickerModal";
import { useCalendarPage } from "./hooks/useCalendarPage";
import { MONTH_LABELS } from "./utils/calendar";

export default function Calendar() {
  const { state, actions } = useCalendarPage();

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={`${MONTH_LABELS[state.month - 1]} ${state.year} · ${state.workoutCount} workout${state.workoutCount === 1 ? "" : "s"}`}
        actions={
          state.streak > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/40 bg-primary-100/15 px-3 py-1.5 text-sm font-semibold text-primary">
              <LuFlame className="h-4 w-4" />
              {state.streak} day streak
            </span>
          ) : undefined
        }
      />

      <PageBody>
        <div className="mx-auto max-w-5xl">
          <div className="liquid-panel mb-4 flex items-center gap-2 rounded-2xl p-2">
            <button
              type="button"
              onClick={actions.prevMonth}
              className="liquid-pill inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground"
              aria-label="Previous month"
            >
              <LuChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={actions.openPicker}
              className="liquid-pill flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-base font-semibold text-foreground"
              aria-label="Choose month and year"
            >
              <span>{MONTH_LABELS[state.month - 1]}</span>
              <span className="font-normal text-muted">{state.year}</span>
              <LuChevronDown className="h-4 w-4 text-secondary" />
            </button>

            <button
              type="button"
              onClick={actions.nextMonth}
              className="liquid-pill inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground"
              aria-label="Next month"
            >
              <LuChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={actions.goToday}
              className="liquid-pill inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold text-foreground"
            >
              Today
            </button>
          </div>

          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading calendar..."
          >
            <div className="gap-5 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
              <CalendarGrid
                cells={state.cells}
                workoutsByDay={state.workoutsByDay}
                selectedKey={state.selectedKey}
                onSelectDay={actions.selectDay}
              />
              <CalendarDayDetail
                className="mt-5 lg:mt-0 lg:sticky lg:top-2"
                selectedCell={state.selectedCell}
                workouts={state.selectedWorkouts}
                isReusing={state.isReusing}
                onReuse={actions.reuse}
              />
            </div>
          </AsyncSection>
        </div>
      </PageBody>

      <MonthPickerModal
        isOpen={state.isPickerOpen}
        viewYear={state.year}
        viewMonth={state.month}
        onClose={actions.closePicker}
        onSelect={actions.setMonthYear}
      />
    </>
  );
}
