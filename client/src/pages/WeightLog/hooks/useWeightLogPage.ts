import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { formatNumber, normalizeUtcIsoString } from "@/lib/helpers";
import { unwrap } from "@/lib/unwrap";
import { bodyMetricService } from "@/services/bodyMetricService";
import type { BodyMetricEntry } from "@/types";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function getLoggedTime(entry: BodyMetricEntry): number {
  const time = new Date(normalizeUtcIsoString(entry.loggedAt)).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatEntryLabel(entry: BodyMetricEntry | null): string {
  if (!entry) {
    return "";
  }

  const weight = entry.bodyWeightKg != null ? `${formatNumber(entry.bodyWeightKg, 1)} kg` : "entry";
  const date = new Date(normalizeUtcIsoString(entry.loggedAt));
  return Number.isNaN(date.getTime()) ? weight : `${weight} · ${DATE_FORMATTER.format(date)}`;
}

export function useWeightLogPage() {
  const [allEntries, setAllEntries] = useState<BodyMetricEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  const [weightKg, setWeightKg] = useState(70);
  const [bodyFat, setBodyFat] = useState(0);
  const [note, setNote] = useState("");
  const [isLogging, setIsLogging] = useState(false);

  const [entryPendingDelete, setEntryPendingDelete] = useState<BodyMetricEntry | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const hasPrefilledRef = useRef(false);

  useEffect(() => {
    async function loadEntries() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await bodyMetricService.list();
        setAllEntries(unwrap(response.data, "Unable to load weight history."));
      } catch (loadError) {
        setAllEntries(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load weight history.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadEntries();
  }, [reloadIndex]);

  const entries = useMemo(
    () => (allEntries ?? []).slice().sort((left, right) => getLoggedTime(right) - getLoggedTime(left)),
    [allEntries],
  );

  useEffect(() => {
    if (hasPrefilledRef.current || entries.length === 0) {
      return;
    }

    hasPrefilledRef.current = true;
    const latest = entries[0];
    if (latest.bodyWeightKg != null) {
      setWeightKg(latest.bodyWeightKg);
    }
    if (latest.bodyFatPercentage != null) {
      setBodyFat(latest.bodyFatPercentage);
    }
  }, [entries]);

  const chartPoints = useMemo(
    () =>
      entries
        .slice()
        .reverse()
        .filter((entry) => entry.bodyWeightKg != null)
        .map((entry) => ({
          label: DATE_FORMATTER.format(new Date(normalizeUtcIsoString(entry.loggedAt))),
          value: entry.bodyWeightKg as number,
        })),
    [entries],
  );

  const latestWeight = entries[0]?.bodyWeightKg ?? null;
  const previousWeight = entries[1]?.bodyWeightKg ?? null;
  const weightChange =
    latestWeight != null && previousWeight != null ? latestWeight - previousWeight : null;
  const latestBodyFat = entries[0]?.bodyFatPercentage ?? null;

  const log = useCallback(async () => {
    if (isLogging) {
      return;
    }

    if (weightKg < 20 || weightKg > 500) {
      toast.error("Enter a body weight between 20 and 500 kg.");
      return;
    }

    setIsLogging(true);

    try {
      const trimmedNote = note.trim();
      const response = await bodyMetricService.log({
        bodyWeightKg: weightKg,
        bodyFatPercentage: bodyFat > 0 ? bodyFat : undefined,
        notes: trimmedNote ? trimmedNote : undefined,
      });
      const entry = unwrap(response.data, "Unable to log weight.");

      setAllEntries((current) => [entry, ...(current ?? [])]);
      setNote("");
      toast.success("Weight logged.");
    } catch (logError) {
      toast.error(logError instanceof Error ? logError.message : "Unable to log weight.");
    } finally {
      setIsLogging(false);
    }
  }, [bodyFat, isLogging, note, weightKg]);

  const requestDelete = useCallback(
    (entry: BodyMetricEntry) => {
      if (deletingId !== null) {
        return;
      }

      setEntryPendingDelete(entry);
    },
    [deletingId],
  );

  const cancelDelete = useCallback(() => {
    if (deletingId !== null) {
      return;
    }

    setEntryPendingDelete(null);
  }, [deletingId]);

  const confirmDelete = useCallback(async () => {
    if (!entryPendingDelete || deletingId !== null) {
      return;
    }

    const entry = entryPendingDelete;
    setDeletingId(entry.id);

    try {
      const response = await bodyMetricService.remove(entry.id);
      unwrap(response.data, "Unable to delete entry.");

      setAllEntries((current) => (current ?? []).filter((item) => item.id !== entry.id));
      setEntryPendingDelete(null);
      toast.success("Entry deleted.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete entry.");
    } finally {
      setDeletingId(null);
    }
  }, [deletingId, entryPendingDelete]);

  const state = useMemo(
    () => ({
      entries,
      isLoading,
      error,
      weightKg,
      bodyFat,
      note,
      isLogging,
      chartPoints,
      latestWeight,
      weightChange,
      latestBodyFat,
      entryCount: entries.length,
      deletingId,
      isDeleteConfirmationOpen: Boolean(entryPendingDelete),
      entryPendingDeleteLabel: formatEntryLabel(entryPendingDelete),
    }),
    [
      entries,
      isLoading,
      error,
      weightKg,
      bodyFat,
      note,
      isLogging,
      chartPoints,
      latestWeight,
      weightChange,
      latestBodyFat,
      deletingId,
      entryPendingDelete,
    ],
  );

  const actions = useMemo(
    () => ({
      setWeightKg,
      setBodyFat,
      setNote,
      log,
      requestDelete,
      cancelDelete,
      confirmDelete,
      reload: () => setReloadIndex((index) => index + 1),
    }),
    [log, requestDelete, cancelDelete, confirmDelete],
  );

  return { state, actions };
}
