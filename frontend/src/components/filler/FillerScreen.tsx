import { useState } from "react";
import { askOf, fieldViews, isComplete, pendingField, youAddLine, type FillMap } from "../../lib/forms.ts";
import { fmtDate } from "../../lib/format.ts";
import type { Stroke } from "../../lib/ink.ts";
import type { Permit } from "../../lib/rules.ts";
import { permitDue, shortFee } from "../../lib/summary.ts";
import type { Facts } from "../../types/api.ts";
import { AskBox } from "./AskBox.tsx";
import { Feed, ReadyNote } from "./Feed.tsx";
import styles from "./FillerScreen.module.css";
import { FormsList } from "./FormsList.tsx";
import { FormToolbar } from "./FormToolbar.tsx";
import { Paper } from "./Paper.tsx";

interface Props {
  permits: Permit[];
  forms: FillMap;
  /** Permit id to the date it was marked sent. */
  sent: Record<string, string>;
  openId: string;
  facts: Facts;
  strokes: Stroke[];
  onStroke: (stroke: Stroke) => void;
  onClearInk: () => void;
  onOpen: (id: string) => void;
  onAnswer: (text: string) => void;
  onEdit: (key: string, value: string) => void;
  onDownload: () => void;
  onMarkSent: () => void;
}

/** Filler stage: the forms list, the paper with its pen, and the feed. */
export function FillerScreen(props: Props) {
  const { permits, forms, sent, openId, facts, strokes } = props;
  const [pen, setPen] = useState(false);

  const permit = permits.find((p) => p.id === openId);
  if (!permit) return null;
  const st = forms[openId];
  const spec = st?.spec;
  const complete = isComplete(st);
  const pending = pendingField(st);
  const ask = askOf(pending);
  const due = permitDue(permit, facts);

  return (
    <div className={styles.screen}>
      <FormsList permits={permits} forms={forms} sent={sent} openId={openId} onOpen={props.onOpen} />

      <main className={styles.center}>
        <FormToolbar
          title={permit.name}
          sub={permit.agency + ". Due " + (due ? fmtDate(due) : "") + ". " + shortFee(permit) + "."}
          pen={pen}
          onTogglePen={() => setPen((v) => !v)}
          hasInk={strokes.length > 0}
          onClearInk={props.onClearInk}
          canDownload={complete}
          onDownload={props.onDownload}
          sentOn={sent[openId]}
          canMarkSent={complete && !sent[openId]}
          onMarkSent={props.onMarkSent}
        />
        <Paper
          agency={spec?.agency_full || permit.agency}
          title={spec?.form_title || permit.name}
          reference={spec?.reference || ""}
          sections={fieldViews(st)}
          pen={pen}
          strokes={strokes}
          onStroke={props.onStroke}
          onEdit={props.onEdit}
        />
      </main>

      <Feed
        entries={st?.feed ?? []}
        working={!!st && !st.waiting && !complete}
        footer={
          ask ? (
            <AskBox key={pending?.key} ask={ask} onAnswer={props.onAnswer} />
          ) : complete ? (
            <ReadyNote channel={permit.channel} youAdd={youAddLine(permit.you_must_add)} />
          ) : null
        }
      />
    </div>
  );
}
