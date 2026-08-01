import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { LuBadgeCheck, LuLoaderCircle } from "react-icons/lu";
import { Modal } from "@/shared/components";
import { Dropdown } from "@/shared/components/Inputs";
import type { AssignPlanOverrideRequest, SubscriptionPlanAdminModel } from "@/types";

export type AssignPlanTarget = {
  userId: number;
  email: string | null;
  currentPlanName: string;
};

const labelClassName = "mb-2 block text-xs font-semibold uppercase tracking-widest text-muted";

type AssignPlanFormProps = {
  target: AssignPlanTarget;
  plans: SubscriptionPlanAdminModel[];
  isSaving: boolean;
  onSave: (payload: AssignPlanOverrideRequest) => Promise<void>;
  onClose: () => void;
};

function AssignPlanForm({ target, plans, isSaving, onSave, onClose }: AssignPlanFormProps) {
  const [planCode, setPlanCode] = useState<string | null>(plans[0]?.code ?? null);
  const [reason, setReason] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const options = useMemo(
    () => plans.map((plan) => ({ label: plan.name, value: plan.code })),
    [plans],
  );

  const canSave = planCode !== null && reason.trim() !== "" && !isSaving;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave || planCode === null) {
      return;
    }

    void onSave({
      planCode,
      reason: reason.trim(),
      endsAt: endsAt ? new Date(`${endsAt}T23:59:59Z`).toISOString() : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="px-5 py-5">
      <div className="liquid-pill flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <span className="min-w-0 truncate text-sm text-foreground">
          {target.email ?? `User ${target.userId}`}
        </span>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted">
          {target.currentPlanName}
        </span>
      </div>

      <div className="mt-5">
        <Dropdown
          label="Plan"
          required
          value={planCode}
          options={options}
          onChange={(value) => setPlanCode(value)}
          placeholder="Select a plan"
        />
      </div>

      <label className="mt-4 block">
        <span className={labelClassName}>Reason</span>
        <input
          type="text"
          value={reason}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setReason(event.target.value)}
          placeholder="Support case, trial, staff account…"
          autoFocus
          className="liquid-input w-full rounded-xl px-4 py-3 text-sm text-foreground"
        />
      </label>

      <label className="mt-4 block">
        <span className={labelClassName}>Ends at</span>
        <input
          type="date"
          value={endsAt}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setEndsAt(event.target.value)}
          className="liquid-input w-full rounded-xl px-4 py-3 text-sm text-foreground"
        />
        <span className="mt-2 block text-xs text-tertiary">
          Leave empty for an override that does not expire.
        </span>
      </label>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="liquid-pill inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSave}
          className="liquid-primary-btn inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSaving ? (
            <LuLoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <LuBadgeCheck className="h-4 w-4" />
          )}
          <span>{isSaving ? "Assigning" : "Assign plan"}</span>
        </button>
      </div>
    </form>
  );
}

type AssignPlanModalProps = {
  target: AssignPlanTarget | null;
  plans: SubscriptionPlanAdminModel[];
  isSaving: boolean;
  onSave: (payload: AssignPlanOverrideRequest) => Promise<void>;
  onClose: () => void;
};

export function AssignPlanModal({
  target,
  plans,
  isSaving,
  onSave,
  onClose,
}: AssignPlanModalProps) {
  return (
    <Modal
      isOpen={target != null}
      onClose={onClose}
      title="Assign a plan"
      titleIcon={<LuBadgeCheck className="h-5 w-5" />}
      maxWidth="md"
    >
      {target ? (
        <AssignPlanForm
          key={target.userId}
          target={target}
          plans={plans}
          isSaving={isSaving}
          onSave={onSave}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
