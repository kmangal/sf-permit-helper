import styles from "./FormToolbar.module.css";

interface Props {
  title: string;
  sub: string;
  pen: boolean;
  onTogglePen: () => void;
  hasInk: boolean;
  onClearInk: () => void;
  canDownload: boolean;
  onDownload: () => void;
  /** Set once the form is marked sent, e.g. "Oct 2". */
  sentOn: string | undefined;
  canMarkSent: boolean;
  onMarkSent: () => void;
}

export function FormToolbar(props: Props) {
  const { title, sub, pen, onTogglePen, hasInk, onClearInk } = props;
  return (
    <div className={styles.bar}>
      <div className={styles.titles}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.sub}>{sub}</div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.pen} aria-pressed={pen} onClick={onTogglePen}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
          </svg>
          {pen ? "Pen on" : "Sign and mark up"}
        </button>
        {hasInk && (
          <button type="button" className={styles.clear} onClick={onClearInk}>
            Clear ink
          </button>
        )}
        <div className={styles.divider} />
        <button type="button" className={styles.download} disabled={!props.canDownload} onClick={props.onDownload}>
          Download PDF
        </button>
        <button type="button" className={styles.send} disabled={!props.canMarkSent} onClick={props.onMarkSent}>
          {props.sentOn ? "Sent " + props.sentOn : "Mark as sent"}
        </button>
      </div>
    </div>
  );
}
