import { useState } from "react";
import type { Permit, OtherItem } from "../../lib/rules.ts";
import { blocker, dueLine, feeSummary, summaryHead, summarySub } from "../../lib/summary.ts";
import type { Facts, TerminalTurn } from "../../types/api.ts";
import { Staggered } from "../ui/Staggered.tsx";
import { BlockerCard } from "./BlockerCard.tsx";
import { FeeCard } from "./FeeCard.tsx";
import { NotNeededList } from "./NotNeededList.tsx";
import { OtherList } from "./OtherList.tsx";
import { PermitCard } from "./PermitCard.tsx";
import styles from "./SummaryScreen.module.css";

/** Umami pixel: each load counts one view of a finished summary. */
const UMAMI_PIXEL = "https://cloud.umami.is/p/AVevDYcYJ";
/** Only the production site counts, as with the tracker's data-domains in index.html. */
const PRODUCTION_HOST = "sf-permit-helper.up.railway.app";

interface Props {
  result: TerminalTurn;
  facts: Facts;
  permits: Permit[];
  others: OtherItem[];
}

/** What the city needs for this event, from the navigator's terminal result. */
export function SummaryScreen({ result, facts, permits, others }: Props) {
  const [showNotNeeded, setShowNotNeeded] = useState(false);
  const eventTitle = String(facts.event_name ?? facts.eventName ?? "");
  const notNeeded = result.not_needed;
  const block = blocker(result);

  return (
    <main className={styles.screen}>
      <div className={styles.page}>
        <div className={styles.event}>{eventTitle}</div>
        <h1 className={styles.head}>{summaryHead(result, permits)}</h1>
        <div className={styles.sub}>{summarySub(result, permits, others)}</div>

        {block ? <BlockerCard blocker={block} /> : <FeeCard fees={feeSummary(result)} />}

        {permits.map((p, i) => (
          <PermitCard key={p.id} permit={p} index={i} due={dueLine(p, facts)} />
        ))}

        <OtherList items={others} after={permits.length} />

        <Staggered index={permits.length} className={styles.tail}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={showNotNeeded}
            onClick={() => setShowNotNeeded((v) => !v)}
          >
            {notNeeded.length} other permits checked and not needed. {showNotNeeded ? "Hide" : "Show"}
          </button>
        </Staggered>

        {showNotNeeded && <NotNeededList items={notNeeded} />}
        {window.location.hostname === PRODUCTION_HOST && (
          <img className={styles.pixel} src={UMAMI_PIXEL} alt="" width={1} height={1} />
        )}
      </div>
    </main>
  );
}
