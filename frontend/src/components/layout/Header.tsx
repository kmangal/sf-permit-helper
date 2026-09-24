import { Link, useMatch, useNavigate } from "react-router";
import styles from "./Header.module.css";

export function Header() {
  const home = useMatch("/");
  const navigate = useNavigate();
  return (
    <>
      <header className={styles.bar}>
        <Link className={styles.brand} to="/">
          San Francisco Permit Helper
        </Link>
        <nav className={styles.actions}>
          {home ? (
            <>
              <Link className={styles.link} to="/rules">
                How it works
              </Link>
              <button type="button" className={styles.reset} onClick={() => navigate("/", { replace: true })}>
                Start over
              </button>
            </>
          ) : (
            <Link className={styles.link} to="/">
              Find your permits
            </Link>
          )}
        </nav>
      </header>
      <div className={styles.accent} />
    </>
  );
}
