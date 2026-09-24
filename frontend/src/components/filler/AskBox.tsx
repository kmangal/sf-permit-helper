import { useId, useState, type FormEvent } from "react";
import type { Ask } from "../../types/api.ts";
import styles from "./AskBox.module.css";

interface Props {
  ask: Ask;
  onAnswer: (text: string) => void;
}

/** The filler is paused on a field only the user can fill. */
export function AskBox({ ask, onAnswer }: Props) {
  const [text, setText] = useState("");
  const promptId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onAnswer(value);
    setText("");
  };

  return (
    <form className={styles.panel} onSubmit={submit}>
      <div id={promptId} className={styles.prompt}>
        {ask.prompt}
      </div>
      <div className={styles.hint}>{ask.hint}</div>
      <div className={styles.row}>
        <input
          className={styles.input}
          aria-labelledby={promptId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={ask.placeholder}
        />
        <button type="submit" className={styles.add}>
          Add
        </button>
      </div>
    </form>
  );
}
