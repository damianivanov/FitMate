import { useCallback, useState } from "react";
import axios from "axios";
import { putToBlobStorage } from "@/lib/blobUpload";
import { compressImageForUpload } from "@/lib/imageCompression";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

// Enough to keep the network busy without opening so many parallel PUTs that the browser queues
// them anyway and the progress counter stops looking like progress.
const CONCURRENCY = 4;

export type BulkUploadFailure = {
  fileName: string;
  message: string;
};

export type BulkUploadState = {
  isOpen: boolean;
  isUploading: boolean;
  hasRun: boolean;
  total: number;
  completed: number;
  uploaded: string[];
  unmatched: string[];
  failed: BulkUploadFailure[];
  ignored: number;
};

const emptyProgress = {
  isUploading: false,
  hasRun: false,
  total: 0,
  completed: 0,
  uploaded: [] as string[],
  unmatched: [] as string[],
  failed: [] as BulkUploadFailure[],
  ignored: 0,
};

function slugFor(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return withoutExtension.trim().toLowerCase();
}

function isImageFile(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(extension);
}

function messageFor(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: string } | undefined;
    return payload?.error ?? error.message;
  }

  return error instanceof Error ? error.message : "Upload failed.";
}

/**
 * Walks a picked folder and pushes each image at the exercise whose slug matches the file name.
 * Every file rides the same direct-to-storage path a single upload uses, so the bytes never pass
 * through the API ingress — only the ticket and confirm calls do.
 */
export function useBulkImageUpload(onUploaded: () => void) {
  const [state, setState] = useState<BulkUploadState>({ isOpen: false, ...emptyProgress });

  const open = useCallback(() => {
    setState({ isOpen: true, ...emptyProgress });
  }, []);

  const close = useCallback(() => {
    setState((current) => (current.isUploading ? current : { isOpen: false, ...emptyProgress }));
  }, []);

  const start = useCallback(
    async (picked: FileList | null) => {
      const all = Array.from(picked ?? []);
      const files = all.filter(isImageFile);

      setState({
        isOpen: true,
        ...emptyProgress,
        isUploading: true,
        total: files.length,
        ignored: all.length - files.length,
      });

      if (files.length === 0) {
        setState((current) => ({ ...current, isUploading: false, hasRun: true }));
        return;
      }

      const uploadOne = async (file: File) => {
        const slug = slugFor(file.name);

        try {
          const prepared = await compressImageForUpload(file);

          const ticketResponse = await adminService.exercises.images.createTicket({
            slug,
            contentType: prepared.type,
          });
          const ticket = unwrap(ticketResponse.data, "Could not start the upload.");

          await putToBlobStorage(ticket.uploadUrl, prepared);

          const confirmed = await adminService.exercises.images.confirm({
            slug,
            blobName: ticket.blobName,
          });
          unwrap(confirmed.data, "Could not finalize the upload.");

          setState((current) => ({
            ...current,
            completed: current.completed + 1,
            uploaded: [...current.uploaded, file.name],
          }));
        } catch (error) {
          // The server answers 404 for a slug that matches nothing, which is an ordinary outcome of
          // pointing at a folder rather than something that went wrong.
          const isUnmatched = axios.isAxiosError(error) && error.response?.status === 404;

          setState((current) => ({
            ...current,
            completed: current.completed + 1,
            unmatched: isUnmatched ? [...current.unmatched, file.name] : current.unmatched,
            failed: isUnmatched
              ? current.failed
              : [...current.failed, { fileName: file.name, message: messageFor(error) }],
          }));
        }
      };

      let next = 0;
      const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, async () => {
        while (next < files.length) {
          const file = files[next];
          next += 1;
          await uploadOne(file);
        }
      });

      await Promise.all(workers);

      setState((current) => ({ ...current, isUploading: false, hasRun: true }));
      onUploaded();
    },
    [onUploaded],
  );

  return { state, open, close, start };
}
