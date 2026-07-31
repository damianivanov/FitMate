import { LuPlus } from "react-icons/lu";
import type { AIConversationSummaryModel } from "@/types";

type ConversationListProps = {
  conversations: AIConversationSummaryModel[];
  activeId: number | null;
  onSelect: (id: number) => Promise<void>;
  onNew: () => Promise<void>;
};

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
}: ConversationListProps) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onNew}
        className="liquid-pill inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold"
      >
        <LuPlus className="h-4 w-4" />
        <span>New conversation</span>
      </button>

      {conversations.length > 0 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {conversations.map((conversation) => (
            <li key={conversation.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={
                  conversation.id === activeId
                    ? "liquid-pill liquid-pill-active max-w-52 cursor-pointer truncate rounded-full px-3 py-2 text-xs font-semibold"
                    : "liquid-pill max-w-52 cursor-pointer truncate rounded-full px-3 py-2 text-xs text-muted"
                }
              >
                {conversation.title ?? "New conversation"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
