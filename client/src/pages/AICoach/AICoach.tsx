import { useEffect, useMemo, useRef, useState } from "react";
import { AIMessageRole, type AIActionModel, type AIMessageModel } from "@/types";
import { ActionCard } from "./components/ActionCard";
import { ChatComposer } from "./components/ChatComposer";
import { CoachSuggestions, CoachWelcome } from "./components/CoachWelcome";
import { ConversationList } from "./components/ConversationList";
import { MessageBubble } from "./components/MessageBubble";
import { ProposalDetailModal } from "./components/ProposalDetailModal";
import { ToolActivityIndicator } from "./components/ToolActivityIndicator";
import { useAICoachPage } from "./hooks/useAICoachPage";
import { PageIntro } from "@/shared/components";
import "./ai-coach.css";

type ThreadEntry = {
  message: AIMessageModel;
  actions: AIActionModel[];
};

/**
 * Pairs each proposal with the assistant turn that made it, so a card sits where the coach
 * offered it rather than at the bottom of the thread underneath newer replies. Anything whose run
 * has no message left — an older thread, a trimmed history — trails the conversation instead of
 * disappearing.
 */
function buildThread(
  messages: AIMessageModel[],
  actions: AIActionModel[],
): { entries: ThreadEntry[]; orphans: AIActionModel[] } {
  const lastMessageIndexByRun = new Map<number, number>();
  messages.forEach((message, index) => {
    if (message.role === AIMessageRole.Assistant && message.aiRunId != null) {
      lastMessageIndexByRun.set(message.aiRunId, index);
    }
  });

  const entries: ThreadEntry[] = messages.map((message) => ({ message, actions: [] }));
  const orphans: AIActionModel[] = [];

  actions.forEach((action) => {
    const index = lastMessageIndexByRun.get(action.aiRunId);
    if (index === undefined) {
      orphans.push(action);
      return;
    }

    entries[index].actions.push(action);
  });

  return { entries, orphans };
}

export default function AICoach() {
  const { state, actions } = useAICoachPage();
  const conversation = state.activeConversation;
  const threadRef = useRef<HTMLDivElement | null>(null);
  const [detailActionId, setDetailActionId] = useState<number | null>(null);

  // Tool traffic is auditing detail, not something a user should read.
  const visibleMessages = useMemo(
    () =>
      conversation?.messages.filter(
        (message) =>
          message.role === AIMessageRole.User || message.role === AIMessageRole.Assistant,
      ) ?? [],
    [conversation?.messages],
  );

  const { entries, orphans } = useMemo(
    () => buildThread(visibleMessages, state.actions),
    [visibleMessages, state.actions],
  );

  const hasThread = visibleMessages.length > 0;

  // Cards land in the same commit as the message they belong to, so the scroll has to wait for
  // them too — keying only on the message count leaves the newest card behind the composer.
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }

    thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
  }, [visibleMessages.length, state.actions, state.isSending]);

  if (state.isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center px-6">
        <p className="text-sm font-semibold text-secondary">Loading your coach...</p>
      </div>
    );
  }

  const errorMessage = state.error ? (
    <p role="alert" className="px-1 pb-2 text-sm text-danger">
      {state.error}
    </p>
  ) : null;

  return (
    <div className="cch-page flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-3 md:px-8">
        <div className="mx-auto w-full max-w-2xl md:max-w-3xl">
          <PageIntro eyebrow="Personal training AI" title="AI Coach" />
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 md:px-8">
        <div className="mx-auto w-full max-w-2xl md:max-w-3xl">
          <ConversationList
            conversations={state.conversations}
            activeId={conversation?.id ?? null}
            onSelect={actions.openConversation}
            onNew={actions.startConversation}
          />
        </div>
      </div>

      {hasThread ? (
        <>
          <div
            ref={threadRef}
            className="liquid-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 md:px-8"
          >
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-6 md:max-w-3xl">
              {entries.map(({ message, actions: messageActions }) => (
                <div key={message.id} className="flex flex-col gap-2">
                  <MessageBubble message={message} />

                  {messageActions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      isBusy={state.busyActionId === action.id}
                      activeWorkout={state.activeWorkout}
                      onConfirm={actions.confirmAction}
                      onReject={actions.rejectAction}
                      onMergeIntoActiveWorkout={actions.mergeActionIntoActiveWorkout}
                      onViewDetail={setDetailActionId}
                    />
                  ))}
                </div>
              ))}

              {orphans.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  isBusy={state.busyActionId === action.id}
                  activeWorkout={state.activeWorkout}
                  onConfirm={actions.confirmAction}
                  onReject={actions.rejectAction}
                  onMergeIntoActiveWorkout={actions.mergeActionIntoActiveWorkout}
                  onViewDetail={setDetailActionId}
                />
              ))}

              <ToolActivityIndicator events={state.progressEvents} isSending={state.isSending} />
            </div>
          </div>

          <div className="shrink-0 px-4 pt-2 pb-3 md:px-8 md:pb-6">
            <div className="mx-auto w-full max-w-2xl md:max-w-3xl">
              {errorMessage}
              <ChatComposer isSending={state.isSending} onSend={actions.send} />
            </div>
          </div>
        </>
      ) : (
        <div className="liquid-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-3 md:px-8 md:pb-6">
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-4 py-4 md:max-w-3xl">
            <CoachWelcome />

            <CoachSuggestions onPick={actions.send} isSending={state.isSending} />

            <p className="cch-hint">
              The more you give me, the better I answer — name the lift, the weight, and how it
              felt.
            </p>

            <div className="mt-auto">
              {errorMessage}
              <ChatComposer isSending={state.isSending} onSend={actions.send} autoFocus />
            </div>
          </div>
        </div>
      )}

      <ProposalDetailModal actionId={detailActionId} onClose={() => setDetailActionId(null)} />
    </div>
  );
}
