import { type Navigator, OPENING_CHAT } from "../../hooks/useNavigator.ts";
import { useStickToBottom } from "../../hooks/useStickToBottom.ts";
import { Working } from "../ui/Working.tsx";
import { ChatMessage } from "./ChatMessage.tsx";
import chatStyles from "./ChatMessage.module.css";
import { Choices } from "./Choices.tsx";
import { Composer } from "./Composer.tsx";
import { EXAMPLE, placeholderFor } from "./copy.ts";
import styles from "./IntakeScreen.module.css";
import { Ledger } from "./Ledger.tsx";

type Props = Pick<
  Navigator,
  "chat" | "known" | "question" | "thinking" | "clarifying" | "ended" | "fresh" | "send" | "answer" | "clarify"
>;

/** Chat intake: transcript, answer choices, composer, and — once something is sent — the ledger beside them. */
export function IntakeScreen(nav: Props) {
  const { chat, known, question, thinking, clarifying, fresh, send, answer, clarify } = nav;
  const asking = question && !thinking;
  // With choices on screen the composer asks about the question; without, it answers it.
  const clarifies = asking && question.options.length > 0;
  // Each new message scrolls into view, even if the reader had scrolled up.
  const { scroller, content } = useStickToBottom<HTMLDivElement, HTMLDivElement>(chat.length);
  return (
    <div className={styles.screen}>
      <section className={styles.main} aria-label="Intake">
        <div ref={scroller} className={styles.transcript}>
          <div ref={content} className={`${styles.column} ${styles.messages}`}>
            {chat.map((item, i) => (
              <ChatMessage key={i} item={item}>
                {/* A space, not a margin, so a wrapped button starts flush with the line. */}
                {fresh && item === OPENING_CHAT.at(-1) && (
                  <>
                    {" "}
                    <button type="button" className={chatStyles.example} onClick={() => send(EXAMPLE)}>
                      See an example
                    </button>
                  </>
                )}
              </ChatMessage>
            ))}
            {thinking && <Working className={styles.thinking}>{thinking}</Working>}
            {clarifying === "waiting" && <Working className={styles.thinking}>Looking into that</Working>}
          </div>
        </div>
        <div className={styles.footer}>
          <div className={styles.column}>
            {asking && (
              <Choices prompt={question.prompt} options={question.options} onPick={answer} disabled={!!clarifying} />
            )}
            {clarifies ? (
              <Composer
                key="clarify"
                placeholder={placeholderFor(nav)}
                label="Clarifying question"
                submitLabel="Ask"
                onSend={clarify}
              />
            ) : (
              <Composer key="answer" placeholder={placeholderFor(nav)} onSend={send} />
            )}
          </div>
        </div>
      </section>
      {!fresh && <Ledger known={known} pending={question?.fact} />}
    </div>
  );
}
