import { humanize } from "../../lib/format.ts";
import type { KnownFact } from "../../types/api.ts";
import { Dots } from "../ui/Dots.tsx";
import styles from "./Ledger.module.css";

interface Props {
  known: KnownFact[];
  /** The fact the navigator is asking about now, if any. */
  pending?: string | null;
}

/** Side ledger of event details, filling in as the intake goes. */
export function Ledger({ known, pending }: Props) {
  return (
    <aside className={styles.ledger} aria-label="Event details">
      <div className={styles.head}>
        <div className={styles.title}>Event details</div>
        <div className={styles.meta}>{known.length} known</div>
      </div>
      <div className={styles.rule} />
      <dl className={styles.rows}>
        {known.map((k) => (
          <div key={k.fact} className={styles.row}>
            <dt className={styles.label}>{humanize(k.fact)}</dt>
            <dd className={styles.value}>{humanize(k.label)}</dd>
          </div>
        ))}
        {pending && (
          <div className={styles.row} data-pending="">
            <dt className={styles.label}>{humanize(pending)}</dt>
            <dd className={styles.value}>
              <Dots className={styles.dots} />
            </dd>
          </div>
        )}
      </dl>
    </aside>
  );
}
