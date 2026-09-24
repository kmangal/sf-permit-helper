import styles from "./Header.module.css";

interface Props {
  onStartOver: () => void;
}

export function Header({ onStartOver }: Props) {
  return (
    <>
      <header className={styles.bar}>
        <div className={styles.brand}>
          <div className={styles.city}>CITY AND COUNTY OF SAN FRANCISCO</div>
          <div className={styles.divider} />
          <div className={styles.product}>Permit Navigator</div>
        </div>
        <nav className={styles.actions}>
          <button type="button" className={styles.reset} onClick={onStartOver}>
            Start over
          </button>
        </nav>
      </header>
      <div className={styles.accent} />
    </>
  );
}
