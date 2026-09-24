import type { Permit } from "../../lib/rules.ts";
import { Staggered } from "../ui/Staggered.tsx";
import card from "./Card.module.css";
import styles from "./PermitCard.module.css";

interface Props {
  permit: Permit;
  /** Position in the list, for the entrance stagger. */
  index: number;
  due: { text: string; late: boolean };
  fillLabel: string;
  onFill: () => void;
}

export function PermitCard({ permit: p, index, due, fillLabel, onFill }: Props) {
  const limits = p.limits.join(" ");
  return (
    <Staggered as="article" index={index} className={`${card.card} ${styles.card}`} aria-label={p.name}>
      <div className={styles.body}>
        <div className={styles.heading}>
          <h2 className={styles.name}>{p.name}</h2>
          <div className={styles.agency}>{p.agency}</div>
        </div>
        <div className={styles.purpose}>{p.purpose}</div>
        <dl className={styles.facts}>
          <dt>Due</dt>
          <dd className={styles.due} data-late={due.late ? "" : undefined}>
            {due.text}
          </dd>
          <dt>Fee</dt>
          <dd className={styles.fee}>{p.fee_basis}</dd>
          {limits && (
            <>
              <dt>Limits</dt>
              <dd className={styles.limits}>{limits}</dd>
            </>
          )}
          {p.verify && (
            <>
              <dt>Unconfirmed</dt>
              <dd className={styles.verify}>{p.verify}</dd>
            </>
          )}
          <dt>Sources</dt>
          <dd className={styles.sources}>
            {p.sources.map((src) => (
              <a key={src.id} href={src.url} target="_blank" rel="noreferrer">
                {src.publisher}: {src.title}
              </a>
            ))}
          </dd>
        </dl>
      </div>
      <div className={styles.actions}>
        {p.can_autofill && (
          <button type="button" className={styles.fill} onClick={onFill}>
            {fillLabel}
          </button>
        )}
        {p.self_serve_url && (
          <a className={styles.apply} href={p.self_serve_url} target="_blank" rel="noreferrer">
            Apply on the city site
          </a>
        )}
      </div>
    </Staggered>
  );
}
