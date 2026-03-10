import type { ChangeEvent, FormEvent } from "react";
import { Modal } from "@/shared/components";
import type { MuscleGroup } from "@/types";

export type ExerciseFormValues = {
  name: string;
  slug: string;
  description: string;
  primaryMuscleGroupId: string;
  secondaryMuscleGroupId: string;
};

type ExerciseEditorModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  isEditing: boolean;
  values: ExerciseFormValues;
  muscleGroups: MuscleGroup[];
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
};

export function ExerciseEditorModal({
  isOpen,
  isSaving,
  isEditing,
  values,
  muscleGroups,
  error,
  onClose,
  onSubmit,
  onFieldChange,
}: ExerciseEditorModalProps) {
  const fieldClassName =
    "liquid-input w-full rounded-xl border-white/70 px-3 py-2.5 outline-none focus:outline-none";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Exercise" : "Create Exercise"}
      maxWidth="2xl"
    >
      <form className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-6" onSubmit={onSubmit}>
        <label className="space-y-3 text-sm font-medium text-slate-700">
          Name
          </label>
          <input
            name="name"
            value={values.name}
            onChange={onFieldChange}
            className={fieldClassName}
            required
          />

        <label className="space-y-3 text-sm font-medium text-slate-700">
          Slug
          <input
            name="slug"
            value={values.slug}
            onChange={onFieldChange}
            className={fieldClassName}
            required
          />
        </label>

        <label className="space-y-3 text-sm font-medium text-slate-700 md:col-span-2">
          Description
          <textarea
            name="description"
            value={values.description}
            onChange={onFieldChange}
            className={`${fieldClassName} min-h-24`}
          />
        </label>

        <label className="space-y-3 text-sm font-medium text-slate-700">
          Primary Muscle Group
          <select
            name="primaryMuscleGroupId"
            value={values.primaryMuscleGroupId}
            onChange={onFieldChange}
            className={fieldClassName}
            required
          >
            <option value="">Select muscle group</option>
            {muscleGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-3 text-sm font-medium text-slate-700">
          Secondary Muscle Group
          <select
            name="secondaryMuscleGroupId"
            value={values.secondaryMuscleGroupId}
            onChange={onFieldChange}
            className={fieldClassName}
          >
            <option value="">None</option>
            {muscleGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-red-700 md:col-span-2">{error}</p>}

        <div className="flex items-center gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={isSaving}
            className="liquid-primary-btn rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {isSaving ? "Saving..." : isEditing ? "Update Exercise" : "Create Exercise"}
          </button>
          <button
            type="button"
            className="liquid-pill rounded-xl px-4 py-2.5 text-sm font-semibold"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
