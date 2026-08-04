import { useCallback, useEffect, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { aiService } from "@/services/aiService";
import {
  AIMessageRole,
  type AIActionModel,
  type AIConversationModel,
  type AIConversationSummaryModel,
  type AIMessageModel,
  type AIUsageSummaryModel,
} from "@/types";

export function useAICoachPage() {
  const [conversations, setConversations] = useState<AIConversationSummaryModel[]>([]);
  const [activeConversation, setActiveConversation] = useState<AIConversationModel | null>(null);
  const [usage, setUsage] = useState<AIUsageSummaryModel | null>(null);
  const [actions, setActions] = useState<AIActionModel[]>([]);
  const [busyActionId, setBusyActionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    const response = await aiService.listConversations();
    const loaded = unwrap(response.data, "Unable to load conversations.");
    setConversations(loaded);
    return loaded;
  }, []);

  const openConversation = useCallback(async (id: number, keepActions = false) => {
    setError(null);
    try {
      const response = await aiService.getConversation(id);
      setActiveConversation(unwrap(response.data, "Unable to open the conversation."));

      // Suggestion cards belong to the run that produced them, so switching threads clears them.
      if (!keepActions) {
        setActions([]);
      }
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Unable to open the conversation.");
    }
  }, []);

  // A new chat is an empty slate, not a row in the database: `send` creates the thread once
  // the user actually has something to ask. Otherwise every visit leaves an empty conversation.
  const startConversation = useCallback(() => {
    setError(null);
    setActions([]);
    setActiveConversation(null);
  }, []);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isSending) {
        return;
      }

      setIsSending(true);
      setActiveTools([]);
      setError(null);

      try {
        // Sending is the only entry point a user needs: the first message opens the thread.
        let target = activeConversation;
        if (!target) {
          const created = await aiService.createConversation();
          target = unwrap(created.data, "Unable to start a conversation.");
        }

        // Show the user's message immediately; the reload after the reply reconciles ids.
        const optimistic: AIMessageModel = {
          id: -Date.now(),
          role: AIMessageRole.User,
          content: trimmed,
          toolName: undefined,
          dateCreated: new Date().toISOString(),
        };

        setActiveConversation({ ...target, messages: [...target.messages, optimistic] });

        const response = await aiService.sendMessage(target.id, { content: trimmed });
        const result = unwrap(response.data, "The assistant could not answer.");

        setActiveTools(result.usedTools);
        setUsage(result.usage);
        setActions((current) => [...current, ...result.actions]);
        await openConversation(target.id, true);
        await loadConversations();
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : "The assistant is unavailable right now. Please try again.",
        );
      } finally {
        setIsSending(false);
      }
    },
    [activeConversation, isSending, loadConversations, openConversation],
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

        const usageResponse = await aiService.getUsage();
        setUsage(unwrap(usageResponse.data, "Unable to load AI usage."));
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
      usage,
      pendingActions: actions,
      busyActionId,
      isLoading,
      isSending,
      activeTools,
      error,
    },
    actions: { openConversation, startConversation, send, confirmAction, rejectAction },
  };
}
