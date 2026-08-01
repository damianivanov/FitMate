import { LuSparkles } from "react-icons/lu";
import { AIMessageRole, type AIMessageModel } from "@/types";

type MessageBubbleProps = {
  message: AIMessageModel;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === AIMessageRole.User;

  // The user's turn is a bubble so the thread is scannable; the coach's turn is plain prose,
  // because a wall of bubbles makes long answers hard to read.
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="liquid-pill max-w-[85%] rounded-3xl rounded-br-lg px-4 py-2.5">
          <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary"
      >
        <LuSparkles className="h-4 w-4" />
      </span>
      <p className="min-w-0 whitespace-pre-wrap pt-0.5 text-sm leading-relaxed text-foreground">
        {message.content}
      </p>
    </div>
  );
}
