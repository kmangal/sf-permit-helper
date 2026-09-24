import { humanize } from "../../lib/format.ts";
import type { Option } from "../../types/api.ts";
import styles from "./Chips.module.css";

interface Props {
  options: Option[];
  /** The raw label goes to the navigator; the humanized one shows in the chat. */
  onPick: (label: string, shown: string) => void;
}

/** Tappable answers to the navigator's current question. */
export function Chips({ options, onPick }: Props) {
  if (!options.length) return null;
  return (
    <div className={styles.chips}>
      {options.map((o) => {
        const shown = humanize(o.label);
        return (
          <button type="button" key={o.label} className={styles.chip} onClick={() => onPick(o.label, shown)}>
            {shown}
          </button>
        );
      })}
    </div>
  );
}
