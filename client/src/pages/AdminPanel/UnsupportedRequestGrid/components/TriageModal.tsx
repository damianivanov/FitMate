import { useState } from "react";
import { Modal } from "@/shared/components";
import {
  UnsupportedRequestStatus,
  type UnsupportedAIRequestModel,
  type UpdateUnsupportedRequestRequest,
} from "@/types";
import { STATUS_LABELS } from "../columns";

const STATUS_OPTIONS = [
  UnsupportedRequestStatus.New,
  UnsupportedRequestStatus.Reviewed,
  UnsupportedRequestStatus.Planned,
  UnsupportedRequestStatus.Implemented,
  UnsupportedRequestStatus.Rejected,
] as const;

type TriageFormProps = {
  request: UnsupportedAIRequestModel;
  isSaving: boolean;
  onSave: (payload: UpdateUnsupportedRequestRequest) => Promise<void>;
  onClose: () => void;
};

/** Mounted per request (see the `key` below), so the fields start from that row's values. */
function TriageForm({ request, isSaving, onSave, onClose }: TriageFormProps) {
  const [status, setStatus] = useState<UnsupportedRequestStatus>(request.status);
  const [adminNotes, setAdminNotes] = useState(request.adminNotes ?? "");
  const [trackingKey, setTrackingKey] = useState(request.externalTrackingKey ?? "");
  const [trackingUrl, setTrackingUrl] = useState(request.externalTrackingUrl ?? "");

  return (
    <div className="flex flex-col gap-4 p-5 md:p-6">
      <div>
        <p className="text-base font-semibold text-foreground">{request.requestedFunctionality}</p>
        <p className="mt-1 text-sm text-muted">
          {`${request.category} · ${request.occurrenceCount} asks from ${request.distinctUserCount} user(s)`}
        </p>
      </div>

      {request.userIntentSummary ? (
        <p className="rounded-xl bg-white/5 p-3 text-sm text-secondary">{request.userIntentSummary}</p>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">Status</span>
        <select
          value={status}
          onChange={(event) => setStatus(Number(event.target.value) as UnsupportedRequestStatus)}
          className="liquid-input rounded-xl px-3 py-2.5"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">Notes</span>
        <textarea
          value={adminNotes}
          onChange={(event) => setAdminNotes(event.target.value)}
          rows={3}
          className="liquid-input rounded-xl px-3 py-2.5"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">Ticket key</span>
          <input
            value={trackingKey}
            onChange={(event) => setTrackingKey(event.target.value)}
            className="liquid-input rounded-xl px-3 py-2.5"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">Ticket URL</span>
          <input
            value={trackingUrl}
            onChange={(event) => setTrackingUrl(event.target.value)}
            className="liquid-input rounded-xl px-3 py-2.5"
          />
        </label>
      </div>

      {request.recentOccurrences.length > 0 ? (
        <section>
          <h3 className="mb-1 text-sm font-bold text-foreground">Recent reports</h3>
          <ul className="flex flex-col gap-0.5">
            {request.recentOccurrences.map((occurrence) => (
              <li key={occurrence.id} className="text-sm text-muted">
                {occurrence.userEmail ?? `User ${occurrence.userId}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
          disabled={isSaving}
          onClick={() =>
            void onSave({
              status,
              adminNotes: adminNotes.trim() || undefined,
              externalTrackingKey: trackingKey.trim() || undefined,
              externalTrackingUrl: trackingUrl.trim() || undefined,
            })
          }
          className="liquid-primary-btn rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

type TriageModalProps = {
  request: UnsupportedAIRequestModel | null;
  isSaving: boolean;
  onSave: (payload: UpdateUnsupportedRequestRequest) => Promise<void>;
  onClose: () => void;
};

export function TriageModal({ request, isSaving, onSave, onClose }: TriageModalProps) {
  return (
    <Modal isOpen={request != null} onClose={onClose} title="Triage request" maxWidth="lg">
      {request ? (
        <TriageForm
          key={request.id}
          request={request}
          isSaving={isSaving}
          onSave={onSave}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
