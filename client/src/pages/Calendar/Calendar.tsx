import { LuFlame } from "react-icons/lu";
import { AsyncSection, NativePage, PageBody, PageIntro } from "@/shared/components";
import { CalendarDayDetail } from "./components/CalendarDayDetail";
import { CalendarGrid } from "./components/CalendarGrid";
import { MonthPickerModal } from "./components/MonthPickerModal";
import { useCalendarPage } from "./hooks/useCalendarPage";
import "./calendar.css";

export default function Calendar() {
  const { state, actions } = useCalendarPage();

  return (
    <>
      <PageBody>
        <NativePage>
          <PageIntro
            eyebrow="Training history"
            title="Calendar"
            action={
              state.streak > 0 ? (
                <span className="native-live-chip inline-flex items-center gap-1">
                  <LuFlame className="h-4 w-4" />
                  {state.streak} DAY STREAK
                </span>
              ) : undefined
            }
          />

          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading calendar..."
          >
            <CalendarGrid
              year={state.year}
              month={state.month}
              cells={state.cells}
              workoutsByDay={state.workoutsByDay}
              selectedKey={state.selectedKey}
              onSelectDay={actions.selectDay}
              onPrevMonth={actions.prevMonth}
              onNextMonth={actions.nextMonth}
              onOpenPicker={actions.openPicker}
            />

            <CalendarDayDetail
              selectedCell={state.selectedCell}
              workouts={state.selectedWorkouts}
              isReusing={state.isReusing}
              onReuse={actions.reuse}
            />
          </AsyncSection>
        </NativePage>
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
