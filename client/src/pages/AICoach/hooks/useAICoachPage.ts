import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { unwrap } from "@/lib/unwrap";
import { aiService } from "@/services/aiService";
import { workoutService } from "@/services/workoutService";
import {
  expandActiveWorkoutIfPresent,
  useActiveWorkoutStore,
} from "@/stores/activeWorkoutStore";
import type {
  ActiveWorkoutModel,
  AIActionModel,
  AIConversationModel,
  AIConversationSummaryModel,
} from "@/types";
import { useAIRunProgress } from "./useAIRunProgress";

export function useAICoachPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<AIConversationSummaryModel[]>([]);
  const [activeConversation, setActiveConversation] = useState<AIConversationModel | null>(null);
  const [actions, setActions] = useState<AIActionModel[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutModel | null>(null);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [busyActionId, setBusyActionId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const resolvingActionRef = useRef(false);
  const viewVersionRef = useRef(0);
  const pendingMessageRef = useRef<{
    conversationId: number;
    content: string;
    clientRequestId: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    const response = await aiService.listConversations();
    const loaded = unwrap(response.data, "Unable to load conversations.");
    setConversations(loaded);
    return loaded;
  }, []);

  // Drives the "add to the session you're in" choice on a workout card. A failure here must not
  // break the chat, so it degrades to the plain confirm rather than surfacing an error.
  const loadActiveWorkout = useCallback(async () => {
    try {
      const response = await workoutService.getActive();
      setActiveWorkout(response.data.success ? (response.data.data ?? null) : null);
    } catch {
      setActiveWorkout(null);
    }
  }, []);

  // Everything the UI needs comes from this one read, so a reload, a refresh or a return from
  // another page all rebuild the same state: messages, pending proposals and any run still going.
  const openConversation = useCallback(async (id: number) => {
    const version = ++viewVersionRef.current;
    setError(null);
    try {
      const response = await aiService.getConversation(id);
      const conversation = unwrap(response.data, "Unable to open the conversation.");

      if (version !== viewVersionRef.current) return;
      setActiveConversation(conversation);
      setActions(conversation.actions ?? []);
      setActiveRunId(conversation.activeRun?.runId ?? null);
    } catch (openError) {
      if (version !== viewVersionRef.current) return;
      setError(openError instanceof Error ? openError.message : "Unable to open the conversation.");
    }
  }, []);

  // A new chat is an empty slate, not a row in the database: `send` creates the thread once
  // the user actually has something to ask. Otherwise every visit leaves an empty conversation.
  const startConversation = useCallback(() => {
    viewVersionRef.current++;
    pendingMessageRef.current = null;
    setError(null);
    setActions([]);
    setActiveRunId(null);
    setActiveConversation(null);
  }, []);

  const handleRunTerminal = useCallback(async () => {
    const conversationId = activeConversation?.id;
    setActiveRunId(null);

    if (conversationId == null) {
      return;
    }

    await openConversation(conversationId);
    await loadConversations();

    // A run may have proposed a workout, and the answer to "add it to what I'm doing?" depends on
    // whether a session is still running by the time the card appears.
    await loadActiveWorkout();
  }, [activeConversation?.id, loadActiveWorkout, loadConversations, openConversation]);

  const { events: progressEvents, currentCode } = useAIRunProgress({
    runId: activeRunId,
    onTerminal: handleRunTerminal,
  });

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || activeRunId != null || submittingRef.current) {
        return false;
      }

      submittingRef.current = true;
      setIsSubmitting(true);
      const version = viewVersionRef.current;
      setError(null);

      try {
        // Sending is the only entry point a user needs: the first message opens the thread.
        let target = activeConversation;
        if (!target) {
          const created = await aiService.createConversation();
          target = unwrap(created.data, "Unable to start a conversation.");
          if (version === viewVersionRef.current) setActiveConversation(target);
        }

        // Retain the id after an ambiguous network failure: retrying the same message then
        // retrieves the accepted run, even if its original 202 never reached the browser.
        const pending = pendingMessageRef.current;
        const submission = pending?.conversationId === target.id && pending.content === trimmed
          ? pending
          : { conversationId: target.id, content: trimmed, clientRequestId: crypto.randomUUID() };
        pendingMessageRef.current = submission;
        const response = await aiService.startMessage(target.id, {
          content: submission.content,
          clientRequestId: submission.clientRequestId,
        });
        const started = unwrap(response.data, "The assistant could not accept that message.");

        pendingMessageRef.current = null;
        if (version === viewVersionRef.current) {
          setActiveConversation({
            ...target,
            messages: [...target.messages.filter((x) => x.id !== started.userMessage.id), started.userMessage],
          });
          setActiveRunId(started.runId);
        }
        return true;
      } catch (sendError) {
        if (version !== viewVersionRef.current) return false;
        setError(
          sendError instanceof Error
            ? sendError.message
            : "The assistant is unavailable right now. Please try again.",
        );
        return false;
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [activeConversation, activeRunId],
  );

  // Confirm and reject share everything except the call, so they run through one helper.
  const resolveAction = useCallback(
    async (actionId: number, confirm: boolean) => {
      if (resolvingActionRef.current) return;
      resolvingActionRef.current = true;
      setBusyActionId(actionId);
      setError(null);

      try {
        const response = confirm
          ? await aiService.confirmAction(actionId)
          : await aiService.rejectAction(actionId);

        const updated = unwrap(response.data, "The suggestion could not be updated.");
        setActions((current) => current.map((x) => (x.id === updated.id ? updated : x)));
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "The suggestion could not be updated.",
        );
      } finally {
        resolvingActionRef.current = false;
        setBusyActionId(null);
      }
    },
    [],
  );

  const confirmAction = useCallback(
    (actionId: number) => resolveAction(actionId, true),
    [resolveAction],
  );

  const rejectAction = useCallback(
    (actionId: number) => resolveAction(actionId, false),
    [resolveAction],
  );

  /**
   * Adds a workout suggestion to the session already running instead of creating a second one. The
   * server resolves the exercises and marks the suggestion done; the exercises then travel through
   * the active-workout store into the live draft, which is what actually persists them.
   */
  const mergeActionIntoActiveWorkout = useCallback(
    async (actionId: number) => {
      const target = activeWorkout;
      if (!target) {
        return;
      }

      if (resolvingActionRef.current) return;
      resolvingActionRef.current = true;
      setBusyActionId(actionId);
      setError(null);

      try {
        const response = await aiService.mergeActionIntoWorkout(actionId, { workoutId: target.id });
        const merged = unwrap(response.data, "The suggestion could not be added.");

        setActions((current) =>
          current.map((x) => (x.id === merged.action.id ? merged.action : x)),
        );

        // Queued before anything navigates, so the exercises cannot be lost in between.
        useActiveWorkoutStore.getState().enqueueProposalExercises(merged.detail.exercises);

        if (!expandActiveWorkoutIfPresent()) {
          navigate(`/workouts/${target.id}`);
        }
      } catch (mergeError) {
        setError(
          mergeError instanceof Error ? mergeError.message : "The suggestion could not be added.",
        );
      } finally {
        resolvingActionRef.current = false;
        setBusyActionId(null);
      }
    },
    [activeWorkout, navigate],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const loaded = await loadConversations();
        await loadActiveWorkout();

        // Land in the thread the user was last in. Without this, returning to the coach always
        // shows the welcome screen, which reads as "my conversation disappeared".
        if (!cancelled && loaded.length > 0) {
          await openConversation(loaded[0].id);
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load the AI coach.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadActiveWorkout, loadConversations, openConversation]);

  return {
    state: {
      conversations,
      activeConversation,
      actions,
      activeWorkout,
      busyActionId,
      isLoading,
      isSending: isSubmitting || activeRunId != null,
      progressEvents,
      currentProgressCode: currentCode,
      error,
    },
    actions: {
      openConversation,
      startConversation,
      send,
      confirmAction,
      rejectAction,
      mergeActionIntoActiveWorkout,
    },
  };
}
