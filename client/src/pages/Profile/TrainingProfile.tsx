import { PrimaryButton } from "@/shared/components/Buttons";
import { Dropdown, SegmentControl, TextareaField } from "@/shared/components/Inputs";
import { SegmentControlSize } from "@/shared/components/Inputs/SegmentControlSize";
import {
  DayOfWeek,
  ExerciseEquipment,
  TrainingExperienceLevel,
  TrainingGoal,
  WeightUnit,
} from "@/types";
import { useTrainingProfilePage } from "./hooks/useTrainingProfilePage";

function humanize(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function enumOptions<T extends number>(source: Record<string, string | number>) {
  return Object.entries(source)
    .filter((entry): entry is [string, T] => typeof entry[1] === "number")
    .map(([name, value]) => ({ label: humanize(name), value }));
}

const goalOptions = enumOptions<TrainingGoal>(TrainingGoal);
const experienceOptions = enumOptions<TrainingExperienceLevel>(TrainingExperienceLevel);
const weightUnitOptions = [
  { label: "Kg", value: WeightUnit.Kg },
  { label: "Lb", value: WeightUnit.Lb },
] as const;
const equipmentOptions = Object.entries(ExerciseEquipment)
  .filter((entry): entry is [string, number] => typeof entry[1] === "number")
  .map(([name]) => name);
const weekdayOptions = [
  { label: "Mon", value: DayOfWeek.Monday },
  { label: "Tue", value: DayOfWeek.Tuesday },
  { label: "Wed", value: DayOfWeek.Wednesday },
  { label: "Thu", value: DayOfWeek.Thursday },
  { label: "Fri", value: DayOfWeek.Friday },
  { label: "Sat", value: DayOfWeek.Saturday },
  { label: "Sun", value: DayOfWeek.Sunday },
] as const;
const aiOptions = [
  { label: "Enabled", value: true },
  { label: "Disabled", value: false },
] as const;

const labelClassName = "block pb-1.5 text-xs font-semibold uppercase tracking-widest text-primary";

type ChipProps = { label: string; selected: boolean; onToggle: () => void };

function Chip({ label, selected, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${
        selected ? "liquid-primary-btn" : "liquid-pill"
      }`}
    >
      {label}
    </button>
  );
}

export default function TrainingProfile() {
  const { state, actions } = useTrainingProfilePage();
  const { formValues } = state;

  if (state.isLoading) {
    return <div className="liquid-panel rounded-2xl p-6 text-sm text-secondary">Loading...</div>;
  }

  return (
    <form className="liquid-panel space-y-6 rounded-2xl p-5 md:p-6" onSubmit={actions.save}>
      <div>
        <h2 className="text-xl font-bold text-foreground">Training Profile</h2>
        <p className="pt-1 text-sm text-secondary">
          Used to personalize programs and AI coaching suggestions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Dropdown
          id="training-goal"
          label="Goal"
          value={formValues.goal}
          onChange={(value) => actions.setField("goal", value ?? TrainingGoal.GeneralFitness)}
          options={goalOptions}
          labelClassName={labelClassName}
        />
        <Dropdown
          id="training-experience"
          label="Experience Level"
          value={formValues.experienceLevel}
          onChange={(value) =>
            actions.setField("experienceLevel", value ?? TrainingExperienceLevel.Beginner)
          }
          options={experienceOptions}
          labelClassName={labelClassName}
        />

        <div>
          <p className={labelClassName}>Training Days Per Week</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((count) => (
              <Chip
                key={count}
                label={String(count)}
                selected={formValues.preferredTrainingDaysPerWeek === count}
                onToggle={() => actions.setField("preferredTrainingDaysPerWeek", count)}
              />
            ))}
          </div>
        </div>

        <div>
          <label className={labelClassName} htmlFor="training-duration">
            Preferred Workout Duration (minutes)
          </label>
          <input
            id="training-duration"
            type="number"
            min={10}
            max={600}
            value={formValues.preferredWorkoutDurationMinutes}
            onChange={(event) =>
              actions.setField("preferredWorkoutDurationMinutes", event.target.value)
            }
            className="liquid-input w-full rounded-full px-3 py-2.5"
            placeholder="e.g. 60"
          />
        </div>

        <div>
          <p className={labelClassName}>Weight Unit</p>
          <SegmentControl<WeightUnit>
            id="training-weight-unit"
            value={formValues.weightUnit}
            onChange={(value) => actions.setField("weightUnit", value)}
            options={weightUnitOptions}
            size={SegmentControlSize.Md}
            className="w-full"
          />
        </div>

        <div>
          <p className={labelClassName}>AI Personalization</p>
          <SegmentControl<boolean>
            id="training-ai-personalization"
            value={formValues.allowAiPersonalization}
            onChange={(value) => actions.setField("allowAiPersonalization", value)}
            options={aiOptions}
            size={SegmentControlSize.Md}
            className="w-full"
          />
        </div>

        <div className="md:col-span-2">
          <p className={labelClassName}>Preferred Training Days</p>
          <div className="flex flex-wrap gap-2">
            {weekdayOptions.map((day) => (
              <Chip
                key={day.value}
                label={day.label}
                selected={formValues.preferredTrainingDays.includes(day.value)}
                onToggle={() => actions.toggleTrainingDay(day.value)}
              />
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <p className={labelClassName}>Available Equipment</p>
          <div className="flex flex-wrap gap-2">
            {equipmentOptions.map((name) => (
              <Chip
                key={name}
                label={humanize(name)}
                selected={formValues.availableEquipment.includes(name)}
                onToggle={() => actions.toggleEquipment(name)}
              />
            ))}
          </div>
        </div>

        <TextareaField
          id="training-restrictions"
          label="Exercise Restrictions / Injuries"
          containerClassName="md:col-span-2 space-y-1.5 text-sm font-medium text-foreground"
          labelClassName={labelClassName}
          value={formValues.exerciseRestrictions}
          onChange={(event) => actions.setField("exerciseRestrictions", event.target.value)}
        />
        <TextareaField
          id="training-preferences"
          label="Additional Preferences"
          containerClassName="md:col-span-2 space-y-1.5 text-sm font-medium text-foreground"
          labelClassName={labelClassName}
          value={formValues.additionalPreferences}
          onChange={(event) => actions.setField("additionalPreferences", event.target.value)}
        />
      </div>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.successMessage ? <p className="text-sm text-success">{state.successMessage}</p> : null}

      <div className="flex justify-end">
        <PrimaryButton type="submit" disabled={state.isSaving} className="w-full md:w-auto">
          {state.isSaving ? "Saving..." : "Save Training Profile"}
        </PrimaryButton>
      </div>
    </form>
  );
}
