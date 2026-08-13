import { useCallback, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import axios from "axios";
import { unwrap } from "@/lib/unwrap";
import { authService } from "@/services/authService";
import { useUserStore } from "@/stores/userStore";

const MAX_BYTES = 8 * 1024 * 1024;

function describeFailure(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data?.error as string | undefined) ?? error.message;
  }

  return error instanceof Error ? error.message : fallback;
}

export function useProfileAvatar() {
  const { user, setUser } = useUserStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = useCallback(() => {
    setError(null);
    fileInputRef.current?.click();
  }, []);

  const upload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Clearing the input here (rather than after the upload) is what lets the same file be
      // picked twice in a row after a failure — otherwise the change event never fires again.
      event.target.value = "";

      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Choose an image file.");
        return;
      }

      if (file.size > MAX_BYTES) {
        setError("That image is too large. Maximum size is 8 MB.");
        return;
      }

      setError(null);
      setIsBusy(true);

      try {
        const response = await authService.uploadAvatar(file);
        setUser(unwrap(response.data, "Unable to update your picture."));
      } catch (uploadError) {
        setError(describeFailure(uploadError, "Unable to update your picture."));
      } finally {
        setIsBusy(false);
      }
    },
    [setUser],
  );

  const remove = useCallback(async () => {
    setError(null);
    setIsBusy(true);

    try {
      const response = await authService.removeAvatar();
      setUser(unwrap(response.data, "Unable to remove your picture."));
    } catch (removeError) {
      setError(describeFailure(removeError, "Unable to remove your picture."));
    } finally {
      setIsBusy(false);
    }
  }, [setUser]);

  const state = useMemo(
    () => ({
      avatarUrl: user.avatarUrl,
      hasAvatar: Boolean(user.avatarUrl),
      isBusy,
      error,
    }),
    [user.avatarUrl, isBusy, error],
  );

  const actions = useMemo(() => ({ pickFile, upload, remove }), [pickFile, upload, remove]);

  return { state, actions, fileInputRef };
}
