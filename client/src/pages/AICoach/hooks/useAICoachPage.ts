import { useCallback, useEffect, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { aiService } from "@/services/aiService";
import type {
  AIActionModel,
  AIConversationModel,
  AIConversationSummaryModel,
} from "@/types";
import { useAIRunProgress } from "./useAIRunProgress";

export function useAICoachPage() {
  const [conversations, setConversations] = useState<AIConversationSummaryModel[]>([]);
  const [activeConversation, setActiveConversation] = useState<AIConversationModel | null>(null);
  const [actions, setActions] = useState<AIActionModel[]>([]);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [busyActionId, setBusyActionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    const response = await aiService.listConversations();
    const loaded = unwrap(response.data, "Unable to load conversations.");
    setConversations(loaded);
    return loaded;
  }, []);

  // Everything the UI needs comes from this one read, so a reload, a refresh or a return from
  // another page all rebuild the same state: messages, pending proposals and any run still going.
  const openConversation = useCallback(async (id: number) => {
    setError(null);
    try {
      const response = await aiService.getConversation(id);
      const conversation = unwrap(response.data, "Unable to open the conversation.");

      setActiveConversation(conversation);
      setActions(conversation.actions ?? []);
      setActiveRunId(conversation.activeRun?.runId ?? null);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Unable to open the conversation.");
    }
  }, []);

  // A new chat is an empty slate, not a row in the database: `send` creates the thread once
  // the user actually has something to ask. Otherwise every visit leaves an empty conversation.
  const startConversation = useCallback(() => {
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
  }, [activeConversation?.id, loadConversations, openConversation]);

  const { events: progressEvents, currentCode } = useAIRunProgress({
    runId: activeRunId,
    onTerminal: handleRunTerminal,
  });

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || activeRunId != null) {
        return;
      }

      setError(null);

      try {
        // Sending is the only entry point a user needs: the first message opens the thread.
        let target = activeConversation;
        if (!target) {
          const created = await aiService.createConversation();
          target = unwrap(created.data, "Unable to start a conversation.");
        }

        const response = await aiService.startMessage(target.id, {
          content: trimmed,
          clientRequestId: crypto.randomUUID(),
        });
        const started = unwrap(response.data, "The assistant could not accept that message.");

        // The 202 already carries the persisted message, so there is nothing to reconcile later.
        setActiveConversation({ ...target, messages: [...target.messages, started.userMessage] });
        setActiveRunId(started.runId);
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : "The assistant is unavailable right now. Please try again.",
        );
      }
    },
    [activeConversation, activeRunId],
  );

  // Confirm and reject share everything except the call, so they run through one helper.
  const resolveAction = useCallback(
    async (actionId: number, confirm: boolean) => {
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

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const loaded = await loadConversations();

        // Land in the thread the user was last in. Without this, returning to the coach always
        // shows the welcome screen, which reads as "my conversation disappeared".
        if (loaded.length > 0) {
          await openConversation(loaded[0].id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the AI coach.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [loadConversations, openConversation]);

  return {
    state: {
      conversations,
      activeConversation,
      pendingActions: actions,
      busyActionId,
      isLoading,
      isSending: activeRunId != null,
      progressEvents,
      currentProgressCode: currentCode,
      error,
    },
    actions: { openConversation, startConversation, send, confirmAction, rejectAction },
  };
}
