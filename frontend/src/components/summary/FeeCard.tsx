import card from "./Card.module.css";
import styles from "./FeeCard.module.css";

interface Props {
  fees: string;
}

/** The estimated fee total for the event. */
export function FeeCard({ fees }: Props) {
  return (
    <section className={`${card.card} ${styles.card}`} aria-label="Estimated fees">
      <div className={styles.label}>Estimated fees for this event</div>
      <div className={styles.fixed}>{fees}</div>
    </section>
  );
}
