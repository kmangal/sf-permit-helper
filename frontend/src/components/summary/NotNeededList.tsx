import type { RuleRef } from "../../types/api.ts";
import { Staggered } from "../ui/Staggered.tsx";
import styles from "./NotNeededList.module.css";

/** Permits the rules engine checked and ruled out. */
export function NotNeededList({ items }: { items: RuleRef[] }) {
  return (
    <div className={styles.list} aria-label="Not needed">
      {items.map((n, i) => (
        <Staggered key={n.id} index={i} className={styles.row}>
          <div className={styles.name}>{n.title}</div>
          <div className={styles.agency}>{n.agency ?? ""}</div>
        </Staggered>
      ))}
    </div>
  );
}
