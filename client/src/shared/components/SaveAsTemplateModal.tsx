import { useState, type ChangeEvent, type FormEvent } from "react";
import { LuLayoutTemplate, LuLoaderCircle } from "react-icons/lu";
import { Modal } from "./Modal";

export type SaveAsTemplatePayload = {
  name: string;
  description?: string;
  isPublic: boolean;
};

type SaveAsTemplateModalProps = {
  isOpen: boolean;
  defaultName?: string;
  isSaving?: boolean;
  onCancel: () => void;
  onConfirm: (payload: SaveAsTemplatePayload) => void;
};

export function SaveAsTemplateModal({
  isOpen,
  defaultName = "",
  isSaving = false,
  onCancel,
  onConfirm,
}: SaveAsTemplateModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setName(defaultName);
      setDescription("");
      setIsPublic(false);
    }
  }

  const handleCancel = () => {
    if (isSaving) {
      return;
    }

    onCancel();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || isSaving) {
      return;
    }

    onConfirm({
      name: trimmedName,
      description: description.trim() || undefined,
      isPublic,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Save as template"
      titleIcon={<LuLayoutTemplate className="h-5 w-5" />}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="px-5 py-5">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
            Template name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
            placeholder="e.g. Push Day A"
            autoFocus
            className="liquid-input w-full rounded-xl px-4 py-3 text-sm text-foreground"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted">
            Description
          </span>
          <textarea
            value={description}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDescription(event.target.value)}
            rows={3}
            placeholder="Optional notes about this template"
            className="liquid-input w-full resize-none rounded-xl px-4 py-3 text-sm leading-relaxed text-foreground"
          />
        </label>

        <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl px-1 py-1">
          <span className="text-sm font-semibold text-foreground">Make public</span>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setIsPublic(event.target.checked)}
            className="h-5 w-5 cursor-pointer accent-primary"
          />
        </label>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="liquid-pill inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !name.trim()}
            className="liquid-primary-btn inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? (
              <LuLoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LuLayoutTemplate className="h-4 w-4" />
            )}
            <span>{isSaving ? "Saving" : "Save template"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
