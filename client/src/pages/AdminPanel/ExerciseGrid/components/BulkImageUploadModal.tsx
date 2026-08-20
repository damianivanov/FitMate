import { useRef, type ChangeEvent } from "react";
import { LuFolderUp } from "react-icons/lu";
import { Modal } from "@/shared/components";
import type { BulkUploadState } from "../hooks/useBulkImageUpload";

type BulkImageUploadModalProps = {
  state: BulkUploadState;
  onClose: () => void;
  onPick: (files: FileList | null) => void;
};

function Summary({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="liquid-pill flex flex-col items-center gap-1 rounded-2xl px-4 py-3">
      <span className={`text-xl font-semibold ${tone}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function FileNameList({ title, files }: { title: string; files: string[] }) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="max-h-40 overflow-y-auto rounded-2xl bg-primary-200 p-3 text-xs text-muted">
        {files.map((file) => (
          <li key={file} className="truncate py-0.5">
            {file}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BulkImageUploadModal({ state, onClose, onPick }: BulkImageUploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const progress = state.total === 0 ? 0 : Math.round((state.completed / state.total) * 100);

  const handleFilesPicked = (event: ChangeEvent<HTMLInputElement>) => {
    onPick(event.target.files);
    event.target.value = "";
  };

  return (
    <Modal
      isOpen={state.isOpen}
      onClose={onClose}
      title="Bulk upload exercise images"
      titleIcon={<LuFolderUp className="h-5 w-5" />}
      maxWidth="lg"
    >
      <div className="space-y-4 p-5 md:p-6">
        <p className="text-sm text-muted">
          Pick a folder of images. Each file is matched to an exercise by name —{" "}
          <span className="font-semibold">barbell-squat.png</span> goes to the exercise with the slug{" "}
          <span className="font-semibold">barbell-squat</span>. A match replaces whatever image the
          exercise has now.
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          webkitdirectory=""
          accept="image/*"
          className="hidden"
          onChange={handleFilesPicked}
        />

        {!state.isUploading && (
          <button
            type="button"
            className="liquid-primary-btn inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold"
            onClick={() => inputRef.current?.click()}
          >
            <LuFolderUp className="h-4 w-4" />
            <span>{state.hasRun ? "Choose another folder" : "Choose folder"}</span>
          </button>
        )}

        {(state.isUploading || state.hasRun) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">
                {state.isUploading ? "Uploading..." : "Finished"}
              </span>
              <span className="text-muted">
                {state.completed} / {state.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary-200">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {state.hasRun && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Summary label="Uploaded" value={state.uploaded.length} tone="text-success" />
              <Summary label="Unmatched" value={state.unmatched.length} tone="text-muted" />
              <Summary label="Failed" value={state.failed.length} tone="text-danger" />
            </div>

            {state.ignored > 0 && (
              <p className="text-xs text-muted">
                {state.ignored} non-image {state.ignored === 1 ? "file was" : "files were"} skipped.
              </p>
            )}

            <FileNameList title="No matching exercise" files={state.unmatched} />

            {state.failed.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-danger">Failed</p>
                <ul className="max-h-40 overflow-y-auto rounded-2xl bg-primary-200 p-3 text-xs">
                  {state.failed.map((failure) => (
                    <li key={failure.fileName} className="py-0.5">
                      <span className="font-semibold">{failure.fileName}</span>
                      <span className="text-muted"> — {failure.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="liquid-pill cursor-pointer rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            onClick={onClose}
            disabled={state.isUploading}
          >
            {state.hasRun ? "Done" : "Cancel"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
