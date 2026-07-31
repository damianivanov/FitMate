import { useState } from "react";
import { Modal } from "@/shared/components";
import type { AssignPlanOverrideRequest, SubscriptionPlanAdminModel } from "@/types";

export type AssignPlanTarget = {
  userId: number;
  email: string | null;
  currentPlanName: string;
};

type AssignPlanFormProps = {
  target: AssignPlanTarget;
  plans: SubscriptionPlanAdminModel[];
  isSaving: boolean;
  onSave: (payload: AssignPlanOverrideRequest) => Promise<void>;
  onClose: () => void;
};

/** Mounted per user (see the `key` below), so the form never carries the previous one's input. */
function AssignPlanForm({ target, plans, isSaving, onSave, onClose }: AssignPlanFormProps) {
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? "");
  const [reason, setReason] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const canSave = planCode !== "" && reason.trim() !== "" && !isSaving;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {target.email ?? `User ${target.userId}`} is currently on {target.currentPlanName}.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">Plan</span>
        <select
          value={planCode}
          onChange={(event) => setPlanCode(event.target.value)}
          className="liquid-input rounded-xl px-3 py-2.5"
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.code}>
              {plan.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">Reason</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Support case, trial, staff account..."
          className="liquid-input rounded-xl px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">Ends at (optional)</span>
        <input
          type="date"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          className="liquid-input rounded-xl px-3 py-2.5"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="liquid-pill rounded-full px-4 py-2.5 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() =>
            void onSave({
              planCode,
              reason: reason.trim(),
              endsAt: endsAt ? new Date(`${endsAt}T23:59:59Z`).toISOString() : undefined,
            })
          }
          className="liquid-primary-btn rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Assign"}
        </button>
      </div>
    </div>
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
    <Modal isOpen={target != null} onClose={onClose} title="Assign a plan" maxWidth="lg">
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
