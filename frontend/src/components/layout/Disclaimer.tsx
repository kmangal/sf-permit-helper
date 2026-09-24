import styles from "./Disclaimer.module.css";

/** Page-wide small print under every screen. */
export function Disclaimer() {
  return (
    <footer className={styles.bar}>
      <p className={styles.text}>
        Results may not be accurate or complete. Use at your own risk, and confirm requirements with the relevant City
        departments before your event.
      </p>
    </footer>
  );
}
