import {
  LuArrowLeft,
  LuCalendar,
  LuClock,
  LuDumbbell,
  LuLayoutTemplate,
  LuListChecks,
  LuRepeat2,
  LuWeight,
} from "react-icons/lu";
import { ActionMenu, AsyncSection, PageBody, SaveAsTemplateModal } from "@/shared/components";
import { ExerciseGroupType } from "@/types";
import { formatMetricValue } from "../WorkoutBuilder/utils/workoutDraft";
import { SummaryStat } from "./components/SummaryStat";
import { useWorkoutSummaryPage } from "./hooks/useWorkoutSummaryPage";
import {
  GROUP_TYPE_LABELS,
  SET_TYPE_LABELS,
  formatDate,
  formatDuration,
  getExerciseName,
  getSetValueText,
} from "./utils/workoutSummaryFormatters";

export default function WorkoutSummary() {
  const { state, actions } = useWorkoutSummaryPage();
  const { workout } = state;

  return (
    <>
      <header className="liquid-page-header flex items-center gap-3 px-4 py-3 md:px-8">
        <button
          type="button"
          onClick={actions.back}
          className="liquid-pill inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full"
          aria-label="Back to workouts"
        >
          <LuArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight text-foreground md:text-2xl">
          {workout ? workout.title : "Workout summary"}
        </h1>
        {workout ? (
          <ActionMenu
            triggerAriaLabel={`${workout.title} actions`}
            items={[
              {
                key: "repeat",
                label: "Repeat workout",
                icon: <LuRepeat2 className="h-4 w-4 shrink-0" />,
                onSelect: actions.repeat,
                variant: "primary",
              },
              {
                key: "save-as-template",
                label: "Save as template",
                icon: <LuLayoutTemplate className="h-4 w-4 shrink-0" />,
                onSelect: actions.saveAsTemplateOpen,
              },
            ]}
          />
        ) : null}
      </header>

      <PageBody>
        <div className="mx-auto max-w-3xl">
          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading workout..."
          >
            {workout ? (
              <div className="space-y-5">
                <section className="liquid-panel rounded-2xl p-4 md:rounded-lg md:p-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <SummaryStat
                      icon={<LuCalendar className="h-4 w-4 text-primary" />}
                      label="Date"
                      value={formatDate(workout.finishedAt ?? workout.startedAt)}
                    />
                    <SummaryStat
                      icon={<LuClock className="h-4 w-4 text-primary" />}
                      label="Duration"
                      value={formatDuration(workout.durationSeconds)}
                    />
                    <SummaryStat
                      icon={<LuWeight className="h-4 w-4 text-primary" />}
                      label="Volume"
                      value={workout.totalVolumeKg == null ? "-" : `${formatMetricValue(workout.totalVolumeKg)} kg`}
                    />
                    <SummaryStat
                      icon={<LuListChecks className="h-4 w-4 text-primary" />}
                      label="Sets"
                      value={`${workout.setCount}`}
                    />
                  </div>

                  {workout.notes ? (
                    <p className="mt-4 whitespace-pre-line rounded-xl bg-white/5 px-4 py-3 text-sm leading-relaxed text-secondary">
                      {workout.notes}
                    </p>
                  ) : null}
                </section>

                {workout.groups
                  .slice()
                  .sort((left, right) => left.sortOrder - right.sortOrder)
                  .map((group) => (
                    <section key={group.id} className="space-y-3">
                      {group.groupType !== ExerciseGroupType.Straight ? (
                        <p className="px-1 text-xs font-semibold uppercase tracking-widest text-primary">
                          {GROUP_TYPE_LABELS[group.groupType]}
                        </p>
                      ) : null}

                      {group.exercises
                        .slice()
                        .sort((left, right) => left.orderIndex - right.orderIndex)
                        .map((exercise) => (
                          <article key={exercise.id} className="liquid-panel rounded-2xl p-4 md:rounded-lg">
                            <div className="flex items-center gap-3">
                              {exercise.exerciseImageUrl ? (
                                <span className="inline-flex h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-(--glass-divider) bg-(--glass-bg-soft)">
                                  <img
                                    src={exercise.exerciseImageUrl}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                </span>
                              ) : (
                                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-(--glass-divider) bg-(--glass-bg-soft) text-muted">
                                  <LuDumbbell className="h-4 w-4" />
                                </span>
                              )}
                              <h2 className="min-w-0 flex-1 truncate text-base font-bold text-foreground">
                                {getExerciseName(exercise)}
                              </h2>
                            </div>

                            {exercise.notes ? (
                              <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-secondary">
                                {exercise.notes}
                              </p>
                            ) : null}

                            <ul className="mt-3 space-y-1.5">
                              {exercise.sets
                                .slice()
                                .sort((left, right) => left.orderIndex - right.orderIndex)
                                .map((set, index) => (
                                  <li
                                    key={set.id}
                                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm"
                                  >
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-foreground">
                                      {index + 1}
                                    </span>
                                    <span className="truncate text-2xs font-semibold uppercase tracking-widest text-muted">
                                      {SET_TYPE_LABELS[set.setType]}
                                    </span>
                                    <span className="font-semibold tabular-nums text-foreground">
                                      {getSetValueText(set)}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </article>
                        ))}
                    </section>
                  ))}
              </div>
            ) : null}
          </AsyncSection>
        </div>
      </PageBody>

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
