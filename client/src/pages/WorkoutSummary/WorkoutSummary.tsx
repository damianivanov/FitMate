import {
  LuActivity,
  LuCheck,
  LuClock,
  LuDumbbell,
  LuLayoutTemplate,
  LuListChecks,
  LuRepeat2,
} from "react-icons/lu";
import {
  ActionMenu,
  AsyncSection,
  BackHeader,
  NativeCard,
  NativeList,
  NativePage,
  NativeSection,
  PageBody,
  SaveAsTemplateModal,
  SectionAction,
} from "@/shared/components";
import { ExerciseGroupType } from "@/types";
import { formatMetricValue } from "../WorkoutBuilder/utils/workoutDraft";
import { useWorkoutSummaryPage } from "./hooks/useWorkoutSummaryPage";
import {
  GROUP_TYPE_LABELS,
  SET_TYPE_LABELS,
  formatDate,
  formatDuration,
  getExerciseName,
  getSetValueText,
} from "./utils/workoutSummaryFormatters";
import "./workout-summary.css";

export default function WorkoutSummary() {
  const { state, actions } = useWorkoutSummaryPage();
  const { workout } = state;

  return (
    <>
      <PageBody>
        <NativePage>
          <BackHeader
            title="Workout summary"
            onBack={actions.back}
            action={
              workout ? (
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
              ) : undefined
            }
          />

          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading workout..."
          >
            {workout ? (
              <>
                <section className="ws-hero">
                  <span className="ws-seal" aria-hidden="true">
                    <LuCheck className="h-7 w-7" strokeWidth={3} />
                  </span>
                  <p>Workout complete</p>
                  <h1>{workout.title}</h1>
                  <small>{formatDate(workout.finishedAt ?? workout.startedAt)}</small>
                </section>

                <div className="ws-stats">
                  <article className="ws-stat">
                    <LuClock className="h-5 w-5" aria-hidden="true" />
                    <span>Duration</span>
                    <b>{formatDuration(workout.durationSeconds)}</b>
                  </article>
                  <article className="ws-stat">
                    <LuActivity className="h-5 w-5" aria-hidden="true" />
                    <span>Volume</span>
                    <b>
                      {workout.totalVolumeKg == null
                        ? "—"
                        : `${formatMetricValue(workout.totalVolumeKg)} kg`}
                    </b>
                  </article>
                  <article className="ws-stat">
                    <LuListChecks className="h-5 w-5" aria-hidden="true" />
                    <span>Sets</span>
                    <b>{workout.setCount}</b>
                  </article>
                </div>

                {workout.notes ? (
                  <NativeCard>
                    <p className="ws-notes">{workout.notes}</p>
                  </NativeCard>
                ) : null}

                <NativeSection
                  title="Exercises"
                  action={
                    <SectionAction onClick={actions.saveAsTemplateOpen}>
                      Save as template
                    </SectionAction>
                  }
                >
                  {workout.groups
                    .slice()
                    .sort((left, right) => left.sortOrder - right.sortOrder)
                    .map((group) => (
                      <div key={group.id} className="grid gap-2.5">
                        {group.groupType !== ExerciseGroupType.Straight ? (
                          <p className="ws-group-label">{GROUP_TYPE_LABELS[group.groupType]}</p>
                        ) : null}

                        {group.exercises
                          .slice()
                          .sort((left, right) => left.orderIndex - right.orderIndex)
                          .map((exercise) => (
                            <NativeList key={exercise.id}>
                              <div className="native-row">
                                <span className="ws-thumb">
                                  {exercise.exerciseImageUrl ? (
                                    <img src={exercise.exerciseImageUrl} alt="" loading="lazy" />
                                  ) : (
                                    <LuDumbbell className="h-4 w-4" />
                                  )}
                                </span>
                                <span className="native-row-copy">
                                  <b>{getExerciseName(exercise)}</b>
                                  <small>
                                    {exercise.sets.length} set
                                    {exercise.sets.length === 1 ? "" : "s"}
                                    {exercise.notes ? ` · ${exercise.notes}` : ""}
                                  </small>
                                </span>
                              </div>

                              <div className="ws-sets">
                                {exercise.sets
                                  .slice()
                                  .sort((left, right) => left.orderIndex - right.orderIndex)
                                  .map((set, index) => (
                                    <div key={set.id} className="ws-set">
                                      <span>{index + 1}</span>
                                      <span className="ws-set-type">
                                        {SET_TYPE_LABELS[set.setType]}
                                      </span>
                                      <span className="ws-set-value">{getSetValueText(set)}</span>
                                    </div>
                                  ))}
                              </div>
                            </NativeList>
                          ))}
                      </div>
                    ))}
                </NativeSection>

                <button type="button" onClick={actions.back} className="native-primary-action">
                  Done
                </button>
              </>
            ) : null}
          </AsyncSection>
        </NativePage>
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
