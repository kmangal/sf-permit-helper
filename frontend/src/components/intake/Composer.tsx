import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import styles from "./Composer.module.css";

interface Props {
  placeholder: string;
  /** What the input and its button are called for screen readers. */
  label?: string;
  submitLabel?: string;
  /** Returns false when the message was not taken; the text then stays put. */
  onSend: (text: string) => boolean;
}

export function Composer({ placeholder, label = "Message", submitLabel = "Send", onSend }: Props) {
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);

  // Grow with the text so a whole paragraph stays visible; CSS caps the height.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [text]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (onSend(text)) setText("");
  };

  // Enter sends; Shift+Enter starts a new line.
  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      <textarea
        ref={box}
        className={styles.input}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={keyDown}
        placeholder={placeholder}
        aria-label={label}
      />
      <button type="submit" className={styles.send} aria-label={submitLabel}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </button>
    </form>
  );
}
