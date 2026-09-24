import type { ReactNode } from "react";
import type { ChatItem } from "../../hooks/useNavigator.ts";
import { Check } from "../ui/Check.tsx";
import { Staggered } from "../ui/Staggered.tsx";
import styles from "./ChatMessage.module.css";

/** `children` trail an agent message's text, e.g. an inline action. */
export function ChatMessage({ item, children }: { item: ChatItem; children?: ReactNode }) {
  return (
    <div className={styles.message} data-kind={item.kind}>
      {item.kind === "agent" && (
        <div className={item.lead ? `${styles.agent} ${styles.lead}` : styles.agent}>
          {item.text}
          {children}
        </div>
      )}
      {item.kind === "user" && <div className={styles.user}>{item.text}</div>}
      {item.kind === "actions" && (
        <ul className={styles.actions} aria-label="Read from your description">
          {item.actions.map((text, i) => (
            <Staggered as="li" key={i} index={i} className={styles.action}>
              <span className={styles.tick}>
                <Check size={9} />
              </span>
              <span>{text}</span>
            </Staggered>
          ))}
        </ul>
      )}
    </div>
  );
}
