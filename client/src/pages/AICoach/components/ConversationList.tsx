import { LuPlus } from "react-icons/lu";
import type { AIConversationSummaryModel } from "@/types";

type ConversationListProps = {
  conversations: AIConversationSummaryModel[];
  activeId: number | null;
  onSelect: (id: number) => Promise<void>;
  onNew: () => void;
};

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
}: ConversationListProps) {
  return (
    <nav aria-label="Conversations" className="flex items-center gap-2 overflow-x-auto py-1">
      <button
        type="button"
        onClick={onNew}
        className="liquid-pill liquid-press inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
      >
        <LuPlus className="h-4 w-4" />
        <span>New chat</span>
      </button>

      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          type="button"
          onClick={() => onSelect(conversation.id)}
          aria-current={conversation.id === activeId ? "page" : undefined}
          className={
            conversation.id === activeId
              ? "liquid-pill liquid-pill-active h-9 max-w-48 shrink-0 cursor-pointer truncate rounded-full px-3 text-sm font-semibold"
              : "liquid-pill h-9 max-w-48 shrink-0 cursor-pointer truncate rounded-full px-3 text-sm text-secondary"
          }
        >
          {conversation.title ?? "New conversation"}
        </button>
      ))}
    </nav>
  );
}
