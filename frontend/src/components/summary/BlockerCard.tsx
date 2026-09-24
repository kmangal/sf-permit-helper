import type { Blocker } from "../../lib/summary.ts";
import card from "./Card.module.css";
import styles from "./BlockerCard.module.css";

interface Props {
  blocker: Blocker;
}

/** Why the event cannot go ahead as described. */
export function BlockerCard({ blocker }: Props) {
  return (
    <section className={`${card.card} ${styles.card}`} aria-label="Why this is blocked">
      <div className={styles.title}>{blocker.title}</div>
      <div className={styles.text}>{blocker.text}</div>
      {blocker.source && <div className={styles.source}>{blocker.source}</div>}
    </section>
  );
}
