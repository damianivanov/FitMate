import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { LookupDropdown, Modal } from "@/shared/components";

export type MuscleGroupFormValues = {
  name: string;
  imageUrl: string;
};

export type MuscleGroupImageLookupOption = {
  value: string;
  label: string;
  imageUrl?: string;
};

type MuscleGroupEditorModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  isEditing: boolean;
  values: MuscleGroupFormValues;
  imageLookupOptions: MuscleGroupImageLookupOption[];
  error: string | null;
  onClose: () => void;
  onSubmit: (values: MuscleGroupFormValues) => Promise<void> | void;
};

export function MuscleGroupEditorModal({
  isOpen,
  isSaving,
  isEditing,
  values,
  imageLookupOptions,
  error,
  onClose,
  onSubmit,
}: MuscleGroupEditorModalProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MuscleGroupFormValues>({
    defaultValues: values,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    reset(values);
  }, [isOpen, reset, values]);

  const resolvedImageLookupOptions = useMemo(() => {
    if (!values.imageUrl || imageLookupOptions.some((option) => option.value === values.imageUrl)) {
      return imageLookupOptions;
    }

    return [{ value: values.imageUrl, label: "Current image", imageUrl: values.imageUrl }, ...imageLookupOptions];
  }, [imageLookupOptions, values.imageUrl]);

  const imageOptions = useMemo(
    () => [{ value: "", label: "No image" }, ...resolvedImageLookupOptions],
    [resolvedImageLookupOptions],
  );

  const fieldClassName =
    "liquid-input w-full rounded-full px-3 py-2.5 outline-none focus:outline-none";
  const labelClassName = "block rounded-full pb-2";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Muscle Group" : "Create Muscle Group"}
      maxWidth="xl"
    >
      <form className="grid grid-cols-1 gap-4 p-5 md:p-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="text-sm font-medium text-slate-700">
          <label htmlFor="muscle-group-name" className={labelClassName}>
            Name
          </label>
          <input
            id="muscle-group-name"
            className={fieldClassName}
            {...register("name", { required: "Name is required." })}
          />
          {errors.name ? <p className="text-sm text-red-700">{errors.name.message}</p> : null}
        </div>

        <Controller
          control={control}
          name="imageUrl"
          render={({ field, fieldState }) => (
            <LookupDropdown
              id="muscle-group-image-url"
              label="Image"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={imageOptions}
              containerClassName="text-sm font-medium text-slate-700"
              labelClassName={labelClassName}
              placeholder="Choose an image"
              error={fieldState.error?.message}
            />
          )}
        />

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            className="liquid-pill rounded-xl px-4 py-2.5 text-sm font-semibold"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="liquid-primary-btn rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {isSaving ? "Saving..." : isEditing ? "Update Muscle Group" : "Create Muscle Group"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
