import { LuLoaderCircle, LuTrash2 } from "react-icons/lu";
import { Modal } from "./Modal";

type DeleteConfirmationModalProps = {
  isOpen: boolean;
  itemName?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmationModal({
  isOpen,
  itemName,
  title = "Delete item",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isDeleting = false,
  onCancel,
  onConfirm,
}: DeleteConfirmationModalProps) {
  const handleCancel = () => {
    if (isDeleting) {
      return;
    }

    onCancel();
  };

  const handleConfirm = () => {
    if (isDeleting) {
      return;
    }

    onConfirm();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      titleIcon={<LuTrash2 className="h-5 w-5" />}
      maxWidth="sm"
    >
      <div className="px-5 py-5">
        <div className="min-w-0">
          <p className="text-base font-semibold leading-7 text-foreground sm:text-lg">
            {itemName ? (
              <>
                Delete <span className="font-extrabold">"{itemName}"</span>?
              </>
            ) : (
              "Delete this item?"
            )}
          </p>
          <p className="mt-2 text-xs font-light italic leading-5 text-muted opacity-70">{description}</p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isDeleting}
            className="liquid-pill inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="liquid-pill liquid-pill-danger inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isDeleting ? <LuLoaderCircle className="h-4 w-4 animate-spin" /> : <LuTrash2 className="h-4 w-4" />}
            <span>{isDeleting ? "Deleting" : confirmLabel}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
