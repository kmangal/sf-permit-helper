import styles from "./Dots.module.css";

/** Three bouncing dots: something is working. */
export function Dots({ className }: { className?: string }) {
  return (
    <div className={[styles.dots, className].filter(Boolean).join(" ")} role="presentation">
      <div className={styles.dot} />
      <div className={styles.dot} />
      <div className={styles.dot} />
    </div>
  );
}
