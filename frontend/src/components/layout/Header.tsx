import styles from "./Header.module.css";

interface Props {
  onStartOver: () => void;
}

export function Header({ onStartOver }: Props) {
  return (
    <>
      <header className={styles.bar}>
        <div className={styles.brand}>San Francisco Permit Helper</div>
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
