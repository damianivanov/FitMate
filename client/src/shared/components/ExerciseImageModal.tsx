import { useEffect, useMemo, useState } from "react";
import { LuImage } from "react-icons/lu";
import { unwrap } from "@/lib/unwrap";
import { exerciseService } from "@/services/exerciseService";
import { Modal } from "./Modal";
import { ImageFileInput } from "./Inputs";

type ExerciseImageModalProps = {
  isOpen: boolean;
  exerciseId: number | null;
  exerciseName?: string;
  currentImageUrl?: string | null;
  onClose: () => void;
  onUploaded: () => void;
};

export function ExerciseImageModal({
  isOpen,
  exerciseId,
  exerciseName,
  currentImageUrl,
  onClose,
  onUploaded,
}: ExerciseImageModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFile(null);
    setError(null);
    setIsUploading(false);
  }, [isOpen, exerciseId]);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleClose = () => {
    if (isUploading) {
      return;
    }

    onClose();
  };

  const handleUpload = async () => {
    if (exerciseId == null || !file) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await exerciseService.uploadImage(exerciseId, file);
      unwrap(response.data, "Upload failed.");
      onUploaded();
      onClose();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const displayedImageUrl = previewUrl ?? currentImageUrl ?? null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={exerciseName ? `Image · ${exerciseName}` : "Exercise image"}
      titleIcon={<LuImage className="h-5 w-5" />}
      maxWidth="md"
    >
      <div className="space-y-4 p-5 md:p-6">
        <div className="flex justify-center">
          {displayedImageUrl ? (
            <img
              src={displayedImageUrl}
              alt="Exercise"
              className="h-44 w-44 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-primary-200 text-primary">
              <LuImage className="h-10 w-10" />
            </div>
          )}
        </div>

        <ImageFileInput
          id="exercise-image-upload"
          fileName={file?.name ?? null}
          onChange={setFile}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="liquid-pill rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="liquid-primary-btn rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60 cursor-pointer"
            onClick={handleUpload}
            disabled={isUploading || !file}
          >
            {isUploading ? "Uploading..." : "Upload image"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
