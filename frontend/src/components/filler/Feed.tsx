import type { ReactNode } from "react";
import type { FeedEntry } from "../../lib/forms.ts";
import { Check } from "../ui/Check.tsx";
import { Working } from "../ui/Working.tsx";
import styles from "./Feed.module.css";

interface Props {
  entries: FeedEntry[];
  /** The step timer is still running. */
  working: boolean;
  /** Shown under the log: the ask box, or the ready-to-send note. */
  footer?: ReactNode;
}

/** A running log of what the filler did on this form. */
export function Feed({ entries, working, footer }: Props) {
  return (
    <aside className={styles.feed} aria-labelledby="feed-title">
      <div className={styles.head}>
        <h2 id="feed-title" className={styles.title}>
          Filling this form
        </h2>
        <div className={styles.sub}>From your event details. Anything missing gets asked here.</div>
      </div>
      <ol className={styles.log}>
        {entries.map((e, i) => (
          <li key={i} className={styles.entry} data-kind={e.kind}>
            <span className={styles.mark}>{e.kind !== "ask" && <Check />}</span>
            <span className={styles.lines}>
              <span className={styles.text}>{e.text}</span>
              {e.sub && <span className={styles.entrySub}>{e.sub}</span>}
            </span>
          </li>
        ))}
        {working && (
          <li>
            <Working className={styles.working}>Filling from your details</Working>
          </li>
        )}
      </ol>
      {footer}
    </aside>
  );
}

/** Once every field is filled. */
export function ReadyNote({ channel, youAdd }: { channel: string; youAdd: string }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>Ready to send</div>
      <div className={styles.channel}>{channel}</div>
      <div className={styles.youAdd}>Still yours to add: {youAdd}</div>
    </div>
  );
}
