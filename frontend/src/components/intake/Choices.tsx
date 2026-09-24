import { humanize } from "../../lib/format.ts";
import type { Option } from "../../types/api.ts";
import styles from "./Choices.module.css";

interface Props {
  /** The question the options answer; names the group for screen readers. */
  prompt: string;
  options: Option[];
  /** The raw label goes to the navigator; the humanized one shows in the chat. */
  onPick: (label: string, shown: string) => void;
  disabled?: boolean;
}

/** The navigator's current question, answered with one tap. */
export function Choices({ prompt, options, onPick, disabled }: Props) {
  if (!options.length) return null;
  return (
    <div className={styles.choices} role="group" aria-label={prompt}>
      {options.map((o) => {
        const shown = humanize(o.label);
        return (
          <button
            type="button"
            key={o.label}
            className={styles.choice}
            disabled={disabled}
            onClick={() => onPick(o.label, shown)}
          >
            {shown}
          </button>
        );
      })}
    </div>
  );
}
