import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { slugify } from "@/lib/helpers";
import { LookupDropdown, Modal } from "@/shared/components";
import type { MuscleGroup } from "@/types";

export type CreateExerciseFormValues = {
  name: string;
  slug: string;
  description: string;
  primaryMuscleGroupId: string;
  secondaryMuscleGroupId: string;
};

type CreateExerciseModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  muscleGroups: MuscleGroup[];
  error: string | null;
  onClose: () => void;
  onSubmit: (values: CreateExerciseFormValues) => Promise<void> | void;
};

const emptyValues: CreateExerciseFormValues = {
  name: "",
  slug: "",
  description: "",
  primaryMuscleGroupId: "",
  secondaryMuscleGroupId: "",
};

export function CreateExerciseModal({
  isOpen,
  isSaving,
  muscleGroups,
  error,
  onClose,
  onSubmit,
}: CreateExerciseModalProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<CreateExerciseFormValues>({
    defaultValues: emptyValues,
  });

  const watchedName = useWatch({
    control,
    name: "name",
  }) ?? "";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    reset(emptyValues);
  }, [isOpen, reset]);

  useEffect(() => {
    if (dirtyFields.slug) {
      return;
    }

    setValue("slug", slugify(watchedName), { shouldDirty: false });
  }, [dirtyFields.slug, setValue, watchedName]);

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
      title="Add New Global Exercise"
      maxWidth="2xl"
    >
      <form className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="text-sm font-medium text-slate-700">
          <label htmlFor="new-exercise-name" className={labelClassName}>Name</label>
          <input
            id="new-exercise-name"
            className={fieldClassName}
            {...register("name", { required: "Name is required." })}
          />
          {errors.name ? <p className="text-sm text-red-700">{errors.name.message}</p> : null}
        </div>

        <div className="text-sm font-medium text-slate-700">
          <label htmlFor="new-exercise-slug" className={labelClassName}>Slug</label>
          <input
            id="new-exercise-slug"
            className={fieldClassName}
            {...register("slug", { required: "Slug is required." })}
          />
          {errors.slug ? <p className="text-sm text-red-700">{errors.slug.message}</p> : null}
        </div>

        <div className="text-sm font-medium text-slate-700 md:col-span-2">
          <label htmlFor="new-exercise-description" className={labelClassName}>Description</label>
          <textarea
            id="new-exercise-description"
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
              id="new-exercise-primary-muscle-group"
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
              id="new-exercise-secondary-muscle-group"
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
            {isSaving ? "Saving..." : "Create Exercise"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
