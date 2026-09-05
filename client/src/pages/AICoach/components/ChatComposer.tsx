import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { LuArrowUp, LuLoaderCircle } from "react-icons/lu";

type ChatComposerProps = {
  isSending: boolean;
  onSend: (content: string) => Promise<boolean>;
  placeholder?: string;
  autoFocus?: boolean;
};

const MAX_COMPOSER_HEIGHT = 200;

export function ChatComposer({
  isSending,
  onSend,
  placeholder = "Ask about training, programs or progress...",
  autoFocus = false,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = value.trim().length > 0 && !isSending;

  // Grow with the content up to a ceiling, then scroll inside the field.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }, [value]);

  async function submit() {
    const content = value.trim();
    if (!content || isSending) {
      return;
    }

    const accepted = await onSend(content);
    if (accepted) {
      // Keep both a failed submission and anything typed while awaiting acceptance.
      setValue((current) => current.trim() === content ? "" : current);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await submit();
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter breaks the line. IME composition must never be interrupted.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    await submit();
  }

  return (
    <form onSubmit={handleSubmit} className="liquid-composer rounded-3xl p-2">
      <label htmlFor="coach-composer" className="sr-only">
        Message your coach
      </label>
      <textarea
        id="coach-composer"
        ref={textareaRef}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="liquid-composer-field w-full resize-none bg-transparent px-3 pt-2 pb-1 text-base outline-none"
      />

      <div className="flex items-center justify-end px-1 pt-1">
        <button
          type="submit"
          disabled={!canSend}
          aria-label={isSending ? "Sending message" : "Send message"}
          className="liquid-primary-btn liquid-press inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSending ? (
            <LuLoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <LuArrowUp className="h-4 w-4" strokeWidth={2.5} />
          )}
        </button>
      </div>
    </form>
  );
}
