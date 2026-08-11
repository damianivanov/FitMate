import { useEffect, useRef, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { aiService } from "@/services/aiService";
import { AIRunStatus, type AIProgressEventModel } from "@/types";
import { TERMINAL_PROGRESS_CODES } from "../progressLabels";

const POLL_INTERVAL_MS = 1_200;

type RunEvents = {
  runId: number | null;
  events: AIProgressEventModel[];
};

type UseAIRunProgressOptions = {
  runId: number | null;
  onTerminal: () => void;
};

/**
 * Observes one run. The EventSource is the fast path and polling takes over if it never opens or
 * drops, so a proxy that buffers SSE degrades to slightly slower updates rather than a stuck UI.
 * Cleanup closes the stream only — leaving the page must never cancel the run.
 */
export function useAIRunProgress({ runId, onTerminal }: UseAIRunProgressOptions) {
  // Events carry the run they belong to, so switching runs resets them by derivation rather than
  // by clearing state from inside an effect.
  const [received, setReceived] = useState<RunEvents>({ runId: null, events: [] });

  // Kept in a ref so a re-render mid-run cannot rewind the cursor and replay events.
  const cursorRef = useRef(0);

  // Held in a ref so a new callback identity does not tear down and restart the stream.
  const onTerminalRef = useRef(onTerminal);

  useEffect(() => {
    onTerminalRef.current = onTerminal;
  }, [onTerminal]);

  useEffect(() => {
    if (runId == null) {
      return;
    }

    cursorRef.current = 0;

    let cancelled = false;
    let finished = false;
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function finish() {
      if (finished) {
        return;
      }

      finished = true;
      source?.close();
      source = null;

      if (pollTimer != null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }

      onTerminalRef.current();
    }

    function accept(incoming: AIProgressEventModel[]) {
      if (cancelled || incoming.length === 0) {
        return;
      }

      const fresh = incoming.filter((event) => event.id > cursorRef.current);
      if (fresh.length === 0) {
        return;
      }

      cursorRef.current = Math.max(cursorRef.current, ...fresh.map((event) => event.id));

      setReceived((current) =>
        current.runId === runId
          ? { runId, events: [...current.events, ...fresh] }
          : { runId, events: fresh },
      );

      if (fresh.some((event) => TERMINAL_PROGRESS_CODES.has(event.code))) {
        finish();
      }
    }

    async function pollOnce() {
      if (cancelled || finished) {
        return;
      }

      try {
        const response = await aiService.getRunSnapshot(runId!, cursorRef.current);
        const snapshot = unwrap(response.data, "Unable to read run progress.");
        accept(snapshot.events);

        const stillRunning =
          snapshot.status === AIRunStatus.Queued || snapshot.status === AIRunStatus.Running;

        if (!stillRunning) {
          finish();
        }
      } catch {
        // Polling is the fallback of last resort; a failed tick simply retries on the next one.
      }
    }

    function startPolling() {
      if (pollTimer != null || finished) {
        return;
      }

      pollTimer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
    }

    async function start() {
      // Replay first: a run started before this component mounted has history to catch up on.
      await pollOnce();

      if (cancelled || finished) {
        return;
      }

      try {
        source = new EventSource(aiService.runEventsUrl(runId!, cursorRef.current), {
          withCredentials: true,
        });

        source.addEventListener("progress", (message) => {
          const parsed = JSON.parse((message as MessageEvent<string>).data) as AIProgressEventModel;
          accept([parsed]);
        });

        source.onerror = () => {
          source?.close();
          source = null;
          startPolling();
        };
      } catch {
        startPolling();
      }
    }

    void start();

    return () => {
      cancelled = true;
      source?.close();

      if (pollTimer != null) {
        clearInterval(pollTimer);
      }
    };
  }, [runId]);

  const events = runId != null && received.runId === runId ? received.events : [];
  const currentCode = events.length > 0 ? events[events.length - 1].code : "run_queued";

  return { events, currentCode };
}
