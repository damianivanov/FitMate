import { useState, type FormEvent } from "react";
import { LuSend } from "react-icons/lu";

type MessageComposerProps = {
  disabled: boolean;
  onSend: (content: string) => Promise<void>;
};

export function MessageComposer({ disabled, onSend }: MessageComposerProps) {
  const [value, setValue] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = value.trim();
    if (!content || disabled) {
      return;
    }

    setValue("");
    await onSend(content);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ask your coach..."
        disabled={disabled}
        className="liquid-input h-11 flex-1 rounded-full px-4 text-sm"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="liquid-primary-btn inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full disabled:opacity-40"
      >
        <LuSend className="h-4 w-4" />
      </button>
    </form>
  );
}
