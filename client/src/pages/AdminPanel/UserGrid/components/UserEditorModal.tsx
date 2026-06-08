import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Modal, SegmentControl, SegmentControlSize } from "@/shared/components";
import type { AdminUser } from "@/types";

export type UserFormValues = {
  isAdmin: boolean;
  isActive: boolean;
};

const roleOptions = [
  { label: "Admin", value: true },
  { label: "Member", value: false },
] as const;

const statusOptions = [
  { label: "Active", value: true },
  { label: "Inactive", value: false },
] as const;

type UserEditorModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  user: AdminUser | null;
  values: UserFormValues;
  isSelf: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<void> | void;
};

export function UserEditorModal({
  isOpen,
  isSaving,
  user,
  values,
  isSelf,
  error,
  onClose,
  onSubmit,
}: UserEditorModalProps) {
  const { control, handleSubmit, reset } = useForm<UserFormValues>({ defaultValues: values });

  useEffect(() => {
    if (isOpen) {
      reset(values);
    }
  }, [isOpen, reset, values]);

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "—";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User" maxWidth="md">
      <form className="space-y-4 p-5 md:p-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="liquid-surface rounded-2xl p-4">
          <p className="truncate text-sm font-bold text-foreground">{displayName}</p>
          <p className="truncate text-xs text-secondary">{user?.email}</p>
        </div>

        <Controller
          control={control}
          name="isAdmin"
          render={({ field }) => (
            <SegmentControl<boolean>
              id="user-role"
              label="Role"
              value={field.value}
              onChange={field.onChange}
              options={roleOptions}
              size={SegmentControlSize.Sm}
              disabled={isSelf}
            />
          )}
        />

        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <SegmentControl<boolean>
              id="user-status"
              label="Status"
              value={field.value}
              onChange={field.onChange}
              options={statusOptions}
              size={SegmentControlSize.Sm}
              disabled={isSelf}
            />
          )}
        />

        {isSelf && <p className="text-xs text-secondary">You can't change your own role or status.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="liquid-pill rounded-full px-4 py-2.5 text-sm font-semibold"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || isSelf}
            className="liquid-primary-btn rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
