import { useEffect, useRef, useState } from "react";
import { Link, useMatch, useNavigate } from "react-router";
import styles from "./Header.module.css";

/** The site bar. On phones its links fold into a menu behind a ☰ button. */
export function Header() {
  const home = useMatch("/");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const close = () => setOpen(false);

  // Escape, or a tap anywhere outside the bar, closes the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <>
      <header ref={bar} className={styles.bar}>
        <Link className={styles.brand} to="/" onClick={close}>
          San Francisco Permit Helper
        </Link>
        <button
          type="button"
          className={styles.menu}
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen(!open)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
        <nav id="site-nav" className={styles.actions} data-open={open || undefined}>
          {home ? (
            <>
              <Link className={styles.link} to="/rules" onClick={close}>
                How it works
              </Link>
              <button
                type="button"
                className={styles.reset}
                onClick={() => {
                  close();
                  navigate("/", { replace: true });
                }}
              >
                Start over
              </button>
            </>
          ) : (
            <Link className={styles.link} to="/" onClick={close}>
              Find your permits
            </Link>
          )}
        </nav>
      </header>
      <div className={styles.accent} />
    </>
  );
}
