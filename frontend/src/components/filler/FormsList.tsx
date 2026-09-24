import { formPill, type FillMap } from "../../lib/forms.ts";
import type { Permit } from "../../lib/rules.ts";
import styles from "./FormsList.module.css";

interface Props {
  permits: Permit[];
  forms: FillMap;
  sent: Record<string, string>;
  openId: string;
  onOpen: (id: string) => void;
}

/** Every required form, with where each one stands. */
export function FormsList({ permits, forms, sent, openId, onOpen }: Props) {
  return (
    <nav className={styles.list} aria-labelledby="forms-title">
      <h2 id="forms-title" className={styles.title}>
        Forms
      </h2>
      <ul className={styles.items}>
        {permits.map((p) => {
          const pill = formPill(forms[p.id], !!sent[p.id]);
          return (
            <li key={p.id}>
              <button
                type="button"
                className={styles.item}
                aria-current={openId === p.id}
                onClick={() => onOpen(p.id)}
              >
                <span className={styles.name}>{p.name}</span>
                <span className={styles.meta}>
                  <span className={styles.agency}>{p.agency}</span>
                  <span className={pill.tone === "filling" ? `${styles.pill} filling` : styles.pill} data-tone={pill.tone}>
                    {pill.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
