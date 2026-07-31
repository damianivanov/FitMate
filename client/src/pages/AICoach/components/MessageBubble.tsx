import { AIMessageRole, type AIMessageModel } from "@/types";

type MessageBubbleProps = {
  message: AIMessageModel;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === AIMessageRole.User;

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "liquid-primary-btn max-w-[80%] rounded-2xl px-4 py-2"
            : "liquid-panel max-w-[80%] rounded-2xl px-4 py-2"
        }
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
