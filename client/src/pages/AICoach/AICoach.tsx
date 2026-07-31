import { AsyncSection, PageBody, PageHeader } from "@/shared/components";
import { AIMessageRole } from "@/types";
import { ActionCard } from "./components/ActionCard";
import { ConversationList } from "./components/ConversationList";
import { MessageBubble } from "./components/MessageBubble";
import { MessageComposer } from "./components/MessageComposer";
import { ToolActivityIndicator } from "./components/ToolActivityIndicator";
import { useAICoachPage } from "./hooks/useAICoachPage";

export default function AICoach() {
  const { state, actions } = useAICoachPage();
  const conversation = state.activeConversation;

  // Tool traffic is auditing detail, not something a user should read.
  const visibleMessages =
    conversation?.messages.filter(
      (message) =>
        message.role === AIMessageRole.User || message.role === AIMessageRole.Assistant,
    ) ?? [];

  return (
    <>
      <PageHeader title="AI Coach" subtitle="Ask about training, programs and progress" />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          loadingLabel="Loading your coach..."
        >
          <div className="flex flex-col gap-4">
            <ConversationList
              conversations={state.conversations}
              activeId={conversation?.id ?? null}
              onSelect={actions.openConversation}
              onNew={actions.startConversation}
            />

            <section className="liquid-panel flex min-h-96 flex-col gap-3 rounded-2xl p-4 md:rounded-lg">
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {conversation ? (
                  visibleMessages.length > 0 ? (
                    visibleMessages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))
                  ) : (
                    <p className="text-sm text-muted">
                      Ask something like &ldquo;What should I train today?&rdquo;
                    </p>
                  )
                ) : (
                  <p className="text-sm text-muted">
                    Start a conversation to plan your training.
                  </p>
                )}
              </div>

              {state.pendingActions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {state.pendingActions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      isBusy={state.busyActionId === action.id}
                      onConfirm={actions.confirmAction}
                      onReject={actions.rejectAction}
                    />
                  ))}
                </div>
              ) : null}

              <ToolActivityIndicator tools={state.activeTools} isSending={state.isSending} />

              {state.usage?.limit != null ? (
                <p className="text-xs text-muted">
                  {state.usage.used} of {state.usage.limit} AI messages used this month
                </p>
              ) : null}

              <MessageComposer
                disabled={!conversation || state.isSending}
                onSend={actions.send}
              />
            </section>
          </div>
        </AsyncSection>
      </PageBody>
    </>
  );
}
