import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { LookupDropdown, Modal } from "@/shared/components";
import { slugify } from "@/lib/helpers";
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
    watch,
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

  const watchedName = watch("name");
  useEffect(() => {
    if (isEditing || dirtyFields.slug) {
      return;
    }

    setValue("slug", slugify(watchedName), { shouldDirty: false });
  }, [dirtyFields.slug, isEditing, setValue, watchedName]);

  const primaryOptions = useMemo(
    () =>
      muscleGroups.map((group) => ({
        value: String(group.id),
        label: group.name,
        imageUrl: group.imageUrl ?? undefined,
      })),
    [muscleGroups],
  );
  const secondaryOptions = useMemo(
    () => [{ value: "", label: "None" }, ...primaryOptions],
    [primaryOptions],
  );

  const fieldClassName =
    "liquid-input w-full rounded-full border-white/70 px-3 py-2.5 outline-none focus:outline-none";
  const labelClassName = "block rounded-full pb-2";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Exercise" : "Create Exercise"}
      maxWidth="2xl"
    >
      <form className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="text-sm font-medium text-slate-700">
          <label htmlFor="exercise-name" className={labelClassName}>Name</label>
          <input
            id="exercise-name"
            className={fieldClassName}
            {...register("name", { required: "Name is required." })}
          />
          {errors.name ? <p className="text-sm text-red-700">{errors.name.message}</p> : null}
        </div>

        <div className="text-sm font-medium text-slate-700">
          <label htmlFor="exercise-slug" className={labelClassName}>Slug</label>
          <input
            id="exercise-slug"
            className={fieldClassName}
            {...register("slug", { required: "Slug is required." })}
          />
          {errors.slug ? <p className="text-sm text-red-700">{errors.slug.message}</p> : null}
        </div>

        <div className="text-sm font-medium text-slate-700 md:col-span-2">
          <label htmlFor="exercise-description" className={labelClassName}>Description</label>
          <textarea
            id="exercise-description"
            className={`${fieldClassName} min-h-24`}
            {...register("description")}
          />
        </div>

        <Controller
          control={control}
          name="primaryMuscleGroupId"
          rules={{ required: "Primary muscle group is required." }}
          render={({ field, fieldState }) => (
            <LookupDropdown
              id="exercise-primary-muscle-group"
              label="Primary Muscle Group"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={primaryOptions}
              containerClassName="text-sm font-medium text-slate-700"
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
            <LookupDropdown
              id="exercise-secondary-muscle-group"
              label="Secondary Muscle Group"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={secondaryOptions}
              containerClassName="text-sm font-medium text-slate-700"
              labelClassName={labelClassName}
              placeholder="None"
              error={fieldState.error?.message}
            />
          )}
        />

        {error && <p className="text-sm text-red-700 md:col-span-2">{error}</p>}

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
