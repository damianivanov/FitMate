import type { ReactNode } from "react";
import { Modal } from "@/shared/components";
import { normalizeUtcIsoString } from "@/lib/helpers";
import type { ErrorModel } from "@/types";

type ErrorDetailModalProps = {
  error: ErrorModel | null;
  onClose: () => void;
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME_FORMATTER.format(date);
}

function DetailRow({ label, value, mono }: { label: string; value?: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-tertiary">{label}</dt>
      <dd className={["min-w-0 break-words text-sm text-foreground", mono ? "font-mono text-xs" : ""].join(" ")}>
        {value || "—"}
      </dd>
    </div>
  );
}

export function ErrorDetailModal({ error, onClose }: ErrorDetailModalProps) {
  return (
    <Modal isOpen={error !== null} onClose={onClose} title="Error Details" maxWidth="3xl">
      <div className="liquid-scrollbar max-h-[75vh] overflow-y-auto p-5 md:p-6">
        {error ? (
          <div className="space-y-4">
            <dl className="liquid-surface rounded-2xl px-4 py-1">
              <DetailRow label="When" value={formatDateTime(error.dateCreated)} />
              <DetailRow label="User" value={error.createdByEmail || "Anonymous"} />
              <DetailRow label="Request" value={error.requestUrl} mono />
              <DetailRow label="Source" value={error.source} />
              <DetailRow label="Action" value={error.action} mono />
              <DetailRow label="User agent" value={error.userAgent} />
            </dl>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-tertiary">Message</p>
              <p className="break-words text-sm font-semibold text-danger">{error.message}</p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-tertiary">Stack trace</p>
              <pre className="liquid-surface liquid-scrollbar max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl p-4 text-xs leading-relaxed text-secondary">
                {error.exception || "No stack trace recorded."}
              </pre>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
