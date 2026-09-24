import type { SiteCheck } from "../../lib/summary.ts";
import card from "./Card.module.css";
import styles from "./SiteCheckCard.module.css";

interface Props {
  check: SiteCheck;
  fees: { fixed: string; note: string };
}

/** What was checked, and the fee total beside it. */
export function SiteCheckCard({ check, fees }: Props) {
  return (
    <section className={`${card.card} ${styles.card}`} aria-label="Site check">
      <div className={styles.body}>
        <div className={styles.title}>{check.title}</div>
        <div className={styles.text}>{check.text}</div>
        {check.source && <div className={styles.source}>{check.source}</div>}
      </div>
      <div className={styles.fees}>
        <div className={styles.feesLabel}>Fees for this event</div>
        <div className={styles.feesFixed}>{fees.fixed}</div>
        <div className={styles.feesNote}>{fees.note}</div>
      </div>
    </section>
  );
}
