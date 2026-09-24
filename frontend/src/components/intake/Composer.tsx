import { useState, type FormEvent } from "react";
import styles from "./Composer.module.css";

interface Props {
  placeholder: string;
  /** Returns false when the message was not taken; the text then stays put. */
  onSend: (text: string) => boolean;
  /** Offer a canned description, sent as soon as it is picked. */
  example?: string;
}

export function Composer({ placeholder, onSend, example }: Props) {
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (onSend(text)) setText("");
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      <input
        className={styles.input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label="Message"
      />
      {example && (
        <button type="button" className={styles.example} onClick={() => onSend(example) && setText("")}>
          Use an example
        </button>
      )}
      <button type="submit" className={styles.send} aria-label="Send">
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
