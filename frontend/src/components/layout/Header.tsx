import styles from "./Header.module.css";

interface Props {
  /** Shown only while a form is open. */
  onBack?: () => void;
  onStartOver: () => void;
}

export function Header({ onBack, onStartOver }: Props) {
  return (
    <>
      <header className={styles.bar}>
        <div className={styles.brand}>
          <div className={styles.city}>CITY AND COUNTY OF SAN FRANCISCO</div>
          <div className={styles.divider} />
          <div className={styles.product}>Permit Navigator</div>
        </div>
        <nav className={styles.actions}>
          {onBack && (
            <button type="button" className={styles.back} onClick={onBack}>
              Back to summary
            </button>
          )}
          <button type="button" className={styles.reset} onClick={onStartOver}>
            Start over
          </button>
        </nav>
      </header>
      <div className={styles.accent} />
    </>
  );
}
