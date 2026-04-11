import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Modal, TextInputField, TextareaField } from "@/shared/components";
import { slugify } from "@/lib/helpers";
import { MuscleGroupDropdown } from "@/pages/AdminPanel/components/MuscleGroupDropdown";
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
  onSubmit: (values: ExerciseFormValues) => Promise<void> | void;
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
}: ExerciseEditorModalProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<ExerciseFormValues>({
    defaultValues: values,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    reset(values);
  }, [isOpen, reset, values]);

  const watchedName = useWatch({
    control,
    name: "name",
  }) ?? "";
  useEffect(() => {
    if (isEditing || dirtyFields.slug) {
      return;
    }

    setValue("slug", slugify(watchedName), { shouldDirty: false });
  }, [dirtyFields.slug, isEditing, setValue, watchedName]);

  const fieldContainerClassName = "space-y-1.5 text-sm font-medium text-foreground";
  const dropdownContainerClassName = "space-y-1.5 text-sm font-medium";
  const labelClassName = "block pb-1.5 text-xs font-semibold uppercase tracking-widest text-primary";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Exercise" : "Create Exercise"}
      maxWidth="2xl"
    >
      <form className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-6" onSubmit={handleSubmit(onSubmit)}>
        <TextInputField
          id="exercise-name"
          label="Name"
          containerClassName={fieldContainerClassName}
          labelClassName={labelClassName}
          error={errors.name?.message}
          {...register("name", { required: "Name is required." })}
        />

        <TextInputField
          id="exercise-slug"
          label="Slug"
          containerClassName={fieldContainerClassName}
          labelClassName={labelClassName}
          error={errors.slug?.message}
          {...register("slug", { required: "Slug is required." })}
        />

        <TextareaField
          id="exercise-description"
          label="Description"
          containerClassName={`${fieldContainerClassName} md:col-span-2`}
          labelClassName={labelClassName}
          {...register("description")}
        />

        <Controller
          control={control}
          name="primaryMuscleGroupId"
          rules={{ required: "Primary muscle group is required." }}
          render={({ field, fieldState }) => (
            <MuscleGroupDropdown
              id="exercise-primary-muscle-group"
              label="Primary Muscle Group"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              muscleGroups={muscleGroups}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="Select muscle group"
              required
              error={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="secondaryMuscleGroupId"
          render={({ field, fieldState }) => (
            <MuscleGroupDropdown
              id="exercise-secondary-muscle-group"
              label="Secondary Muscle Group"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              muscleGroups={muscleGroups}
              leadingOptions={[{ value: "", label: "None" }]}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="None"
              error={fieldState.error?.message}
            />
          )}
        />

        {error && <p className="text-sm text-danger md:col-span-2">{error}</p>}

        <div className="flex w-full items-center justify-between gap-3 md:col-span-2">
          <button
            type="button"
            className="liquid-pill rounded-full px-4 py-2.5 text-sm font-semibold"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="liquid-primary-btn rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {isSaving ? "Saving..." : isEditing ? "Update Exercise" : "Create Exercise"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

