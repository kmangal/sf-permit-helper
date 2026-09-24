import type { OtherItem } from "../../lib/rules.ts";
import { Staggered } from "../ui/Staggered.tsx";
import styles from "./OtherList.module.css";

interface Props {
  items: OtherItem[];
  /** How many cards precede it, so it lands after them. */
  after: number;
}

/** Requirements, plans and advisories that are not permits: "Also on your list". */
export function OtherList({ items, after }: Props) {
  if (!items.length) return null;
  return (
    <Staggered as="section" index={after} className={styles.section} aria-labelledby="also-on-your-list">
      <h2 id="also-on-your-list" className={styles.title}>
        Also on your list
      </h2>
      <div className={styles.rule} />
      {items.map((o) => (
        <div key={o.id} className={styles.row}>
          <div className={styles.body}>
            <div className={styles.heading}>
              <div className={styles.name}>{o.title}</div>
              <div className={styles.agency}>{o.agency}</div>
            </div>
            {o.text && <div className={styles.text}>{o.text}</div>}
          </div>
          <div className={styles.meta}>
            <div className={styles.kind}>{o.kind}</div>
            {o.url && (
              <a href={o.url} target="_blank" rel="noreferrer">
                {o.source}
              </a>
            )}
          </div>
        </div>
      ))}
    </Staggered>
  );
}
