import type { Navigator } from "../../hooks/useNavigator.ts";
import { Working } from "../ui/Working.tsx";
import { ChatMessage } from "./ChatMessage.tsx";
import { Chips } from "./Chips.tsx";
import { Composer } from "./Composer.tsx";
import { EXAMPLE, placeholderFor } from "./copy.ts";
import styles from "./IntakeScreen.module.css";
import { Ledger } from "./Ledger.tsx";

type Props = Pick<Navigator, "chat" | "known" | "question" | "thinking" | "ended" | "fresh" | "send" | "answer">;

/** Chat intake: transcript, suggestion chips, composer, and the ledger beside them. */
export function IntakeScreen(nav: Props) {
  const { chat, known, question, thinking, fresh, send, answer } = nav;
  return (
    <div className={styles.screen}>
      <section className={styles.main} aria-label="Intake">
        <div className={styles.transcript}>
          <div className={`${styles.column} ${styles.messages}`}>
            {chat.map((item, i) => (
              <ChatMessage key={i} item={item} />
            ))}
            {thinking && <Working className={styles.thinking}>{thinking}</Working>}
          </div>
        </div>
        <div className={styles.footer}>
          <div className={styles.column}>
            {question && !thinking && <Chips options={question.options} onPick={answer} />}
            <Composer placeholder={placeholderFor(nav)} onSend={send} example={fresh ? EXAMPLE : undefined} />
          </div>
        </div>
      </section>
      <Ledger known={known} pending={question?.fact} />
    </div>
  );
}
