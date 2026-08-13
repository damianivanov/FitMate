import { useState } from "react";
import { LuArrowLeft, LuCalendarDays, LuPlus } from "react-icons/lu";
import {
  AsyncSection,
  DeleteConfirmationModal,
  PageBody,
  SaveAsTemplateModal,
  SegmentControl,
  SegmentControlSize,
  SwapIn,
} from "@/shared/components";
import { formatDateOnlyLong } from "@/shared/utils/dateOnly";
import { CoachStrip } from "./components/CoachStrip";
import { FocusCard } from "./components/FocusCard";
import { SessionRow } from "./components/SessionRow";
import { WeekPicker } from "./components/WeekPicker";
import { WeekSnapshot } from "./components/WeekSnapshot";
import { useProgramToday } from "./hooks/useProgramToday";
import { useTrainingWeek } from "./hooks/useTrainingWeek";
import { useWorkoutsPage, type WorkoutFilter } from "./hooks/useWorkoutsPage";
import "./workouts.css";

const FILTER_OPTIONS: { value: WorkoutFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "In progress" },
  { value: "finished", label: "Finished" },
];

const TITLE_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default function Workouts() {
  const { state, actions } = useWorkoutsPage();
  const { todayModel, isLoading: isProgramLoading, reload: reloadProgram } = useProgramToday();
  const week = useTrainingWeek(state.workouts);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // The tap knows which way the list travelled, so the content can arrive from the side
  // the user reached for — and leave the same way when they come back.
  const changeFilter = (next: WorkoutFilter) => {
    const nextIndex = FILTER_OPTIONS.findIndex((option) => option.value === next);
    setDirection(nextIndex >= state.filterIndex ? "forward" : "back");
    actions.setFilter(next);
  };

  const visibleCount = state.filteredWorkouts.length;

  return (
    <>
      <PageBody>
        <div className="wk-body mx-auto w-full max-w-2xl">
          {/* The title travels with the content the way the reference does it, so the screen
              opens on the week rather than on chrome. The app header picks the name up once
              this scrolls away. */}
          <header className="wk-title">
            <p className="liquid-page-eyebrow">{TITLE_DATE_FORMATTER.format(new Date())}</p>
            <h1 className="liquid-page-title">Training</h1>
          </header>

          <WeekPicker days={week.days} selectedDate={week.selectedDate} onSelect={week.selectDate} />

          {week.isTodaySelected ? null : (
            <button type="button" className="wk-day-context" onClick={week.resetToToday}>
              <span className="wk-day-context-glyph">
                <LuCalendarDays className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <b>{formatDateOnlyLong(week.selectedDate)}</b>
                <small>
                  {week.selectedSessions.length > 0
                    ? `${week.selectedSessions.length} session${week.selectedSessions.length === 1 ? "" : "s"} logged`
                    : "Nothing logged"}
                </small>
              </span>
              <span className="wk-day-context-back">
                <LuArrowLeft className="h-3.5 w-3.5" />
                Today
              </span>
            </button>
          )}

          <FocusCard
            todayModel={todayModel}
            isProgramLoading={isProgramLoading}
            workouts={state.workouts}
            selectedDate={week.selectedDate}
            isTodaySelected={week.isTodaySelected}
            selectedSessions={week.selectedSessions}
            onOpenWorkout={actions.open}
            onReloadProgram={reloadProgram}
          />

          {/* Held back until the list has landed: the figures are counted from it, and zeros
              that jump to real numbers a moment later read as a wrong answer, not a pending one. */}
          {state.isLoading ? null : (
            <section className="wk-section">
              <div className="wk-section-head">
                <h2>This week</h2>
              </div>
              <WeekSnapshot snapshot={week.snapshot} />
            </section>
          )}

          <section className="wk-section">
            <div className="wk-section-head">
              <h2>Sessions</h2>
              <button type="button" className="wk-new-btn" onClick={actions.create}>
                <LuPlus className="h-4 w-4" />
                New
              </button>
            </div>

            <SegmentControl
              value={state.filter}
              options={FILTER_OPTIONS}
              onChange={changeFilter}
              size={SegmentControlSize.Md}
              className="wk-filter"
            />

            <AsyncSection
              isLoading={state.isLoading}
              error={state.error}
              onRetry={actions.reload}
              loadingLabel="Loading workouts..."
              isEmpty={state.workouts.length === 0}
              emptyState={
                <div className="liquid-panel liquid-empty">
                  <p className="liquid-empty-title">No workouts yet</p>
                  <p className="liquid-empty-body">
                    Log your first session and this week fills in behind it.
                  </p>
                  <button type="button" onClick={actions.create} className="wk-empty-cta">
                    <LuPlus className="h-4 w-4" />
                    New workout
                  </button>
                </div>
              }
            >
              <SwapIn swapKey={state.filter} direction={direction}>
                {visibleCount === 0 ? (
                  <div className="liquid-panel liquid-empty">
                    <p className="liquid-empty-title">Nothing here</p>
                    <p className="liquid-empty-body">No workouts match this filter.</p>
                  </div>
                ) : (
                  <div className="wk-list">
                    {state.filteredWorkouts.map((workout) => (
                      <SessionRow
                        key={workout.id}
                        workout={workout}
                        isDeleting={state.deletingWorkoutId === workout.id}
                        onOpen={actions.open}
                        onDelete={actions.requestDelete}
                        onRepeat={actions.repeat}
                        onSaveAsTemplate={actions.requestSaveAsTemplate}
                      />
                    ))}
                  </div>
                )}
              </SwapIn>
            </AsyncSection>
          </section>

          <CoachStrip />
        </div>
      </PageBody>

      <DeleteConfirmationModal
        isOpen={state.isDeleteConfirmationOpen}
        itemName={state.workoutPendingDeleteTitle}
        title="Delete workout"
        isDeleting={state.deletingWorkoutId !== null}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />

      <SaveAsTemplateModal
        isOpen={state.isSaveAsTemplateOpen}
        defaultName={state.saveAsTemplateDefaultName}
        isSaving={state.isSavingTemplate}
        onCancel={actions.cancelSaveAsTemplate}
        onConfirm={actions.confirmSaveAsTemplate}
      />
    </>
  );
}
