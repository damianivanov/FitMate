import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearTemplateBuilderDraft,
  loadTemplateBuilderDraft,
  saveTemplateBuilderDraft,
} from "@/services/templateBuilderDraftStorage";
import {
  hasTemplateBuilderDraftContent,
  type TemplateBuilderDraftContent,
  type TemplateBuilderDraftModel,
} from "../models/templateBuilderDraft";

export type HandleRestoreTemplateDraft = (
  restoredDraft: TemplateBuilderDraftModel,
  isCancelled: () => boolean,
) => Promise<void> | void;

type UseTemplateDraftArgs = {
  draftContent: TemplateBuilderDraftContent;
  draftContentFingerprint: string;
  onRestoreDraft: HandleRestoreTemplateDraft;
  autosaveIntervalMs: number;
  enabled?: boolean;
};

type MarkCurrentDraftAsSavedOptions = {
  clearPersistedDraft?: boolean;
};

type UseTemplateDraftResult = {
  draftVersion: number;
  isDraftHydrated: boolean;
  markCurrentDraftAsSaved: (options?: MarkCurrentDraftAsSavedOptions) => void;
  resetDraft: () => void;
};

export function useTemplateDraft({
  draftContent,
  draftContentFingerprint,
  onRestoreDraft,
  autosaveIntervalMs,
  enabled = true,
}: UseTemplateDraftArgs): UseTemplateDraftResult {
  const [draftVersion, setDraftVersion] = useState(0);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const currentDraft = useMemo<TemplateBuilderDraftModel>(
    () => ({
      draftVersion,
      ...draftContent,
    }),
    [draftContent, draftVersion],
  );
  const currentDraftRef = useRef<TemplateBuilderDraftModel | null>(null);
  const lastSavedDraftVersionRef = useRef(0);
  const lastTrackedDraftFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsDraftHydrated(true);
      return;
    }

    let isCancelled = false;
    setIsDraftHydrated(false);

    const restoreDraftAsync = async () => {
      const restoredDraft = loadTemplateBuilderDraft();
      if (!restoredDraft) {
        lastSavedDraftVersionRef.current = 0;
        setIsDraftHydrated(true);
        return;
      }

      setDraftVersion(restoredDraft.draftVersion);
      lastSavedDraftVersionRef.current = restoredDraft.draftVersion;

      try {
        await onRestoreDraft(restoredDraft, () => isCancelled);
      } finally {
        if (!isCancelled) {
          setIsDraftHydrated(true);
        }
      }
    };

    void restoreDraftAsync();

    return () => {
      isCancelled = true;
    };
  }, [enabled, onRestoreDraft]);

  useEffect(() => {
    if (!enabled || !isDraftHydrated) {
      return;
    }

    if (lastTrackedDraftFingerprintRef.current === null) {
      lastTrackedDraftFingerprintRef.current = draftContentFingerprint;
      return;
    }

    if (lastTrackedDraftFingerprintRef.current === draftContentFingerprint) {
      return;
    }

    lastTrackedDraftFingerprintRef.current = draftContentFingerprint;
    setDraftVersion((previous) => previous + 1);
  }, [draftContentFingerprint, enabled, isDraftHydrated]);

  useEffect(() => {
    currentDraftRef.current = currentDraft;
  }, [currentDraft]);

  useEffect(() => {
    if (!enabled || !isDraftHydrated) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const draft = currentDraftRef.current;
      if (!draft) {
        return;
      }

      if (draft.draftVersion === lastSavedDraftVersionRef.current) {
        return;
      }

      if (!hasTemplateBuilderDraftContent(draft)) {
        clearTemplateBuilderDraft();
        lastSavedDraftVersionRef.current = draft.draftVersion;
        return;
      }

      const wasSaved = saveTemplateBuilderDraft(draft);
      if (wasSaved) {
        lastSavedDraftVersionRef.current = draft.draftVersion;
      }
    }, autosaveIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autosaveIntervalMs, enabled, isDraftHydrated]);

  const markCurrentDraftAsSaved = useCallback(
    (options?: MarkCurrentDraftAsSavedOptions) => {
      const currentDraftVersion = currentDraftRef.current?.draftVersion ?? draftVersion;
      lastSavedDraftVersionRef.current = currentDraftVersion;

      if (options?.clearPersistedDraft) {
        clearTemplateBuilderDraft();
      }
    },
    [draftVersion],
  );

  const resetDraft = useCallback(() => {
    setDraftVersion(0);
    lastSavedDraftVersionRef.current = 0;
    lastTrackedDraftFingerprintRef.current = null;
    clearTemplateBuilderDraft();
  }, []);

  return {
    draftVersion,
    isDraftHydrated,
    markCurrentDraftAsSaved,
    resetDraft,
  };
}
