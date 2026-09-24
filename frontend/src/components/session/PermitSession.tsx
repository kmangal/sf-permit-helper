// One run through the app: intake chat, then the summary, then the filler.
// Owns the state the three screens share; each screen only renders.

import { useCallback, useMemo, useState } from "react";
import { useFormFiller } from "../../hooks/useFormFiller.ts";
import { useInk } from "../../hooks/useInk.ts";
import { useNavigator } from "../../hooks/useNavigator.ts";
import { useToast } from "../../hooks/useToast.ts";
import { errorMessage, markSent } from "../../lib/api.ts";
import { exportPdf } from "../../lib/exportPdf.ts";
import { fmtDate } from "../../lib/format.ts";
import { toOthers, toPermits } from "../../lib/rules.ts";
import { permitDue, shortFee } from "../../lib/summary.ts";
import type { Facts } from "../../types/api.ts";
import { FillerScreen } from "../filler/FillerScreen.tsx";
import { IntakeScreen } from "../intake/IntakeScreen.tsx";
import { Header } from "../layout/Header.tsx";
import { SummaryScreen } from "../summary/SummaryScreen.tsx";
import { Toast } from "../ui/Toast.tsx";
import styles from "./PermitSession.module.css";

export function PermitSession({ onStartOver }: { onStartOver: () => void }) {
  const { toast, show } = useToast();
  const fail = useCallback((err: unknown) => show(errorMessage(err)), [show]);
  const nav = useNavigator({ onError: fail });
  const { result } = nav;

  // Facts start from the navigator's result; shared fields typed on a form override them.
  const [factEdits, setFactEdits] = useState<Facts>({});
  const facts = useMemo(() => ({ ...result?.facts, ...factEdits }), [result, factEdits]);
  const permits = useMemo(() => toPermits(result), [result]);
  const others = useMemo(() => toOthers(result), [result]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});
  const ink = useInk();

  const describeDone = useCallback(
    (id: string) => {
      const p = permits.find((x) => x.id === id);
      if (!p) return "";
      const due = permitDue(p, facts);
      return shortFee(p) + (due ? ", due " + fmtDate(due) : "");
    },
    [permits, facts],
  );
  const onSharedFact = useCallback((key: string, value: string) => {
    setFactEdits((prev) => ({ ...prev, [key]: value }));
  }, []);
  const filler = useFormFiller({ active: openId !== null, facts, describeDone, onSharedFact, onError: fail });
  const { open: openFill } = filler;

  const openForm = useCallback(
    (id: string) => {
      setOpenId(id);
      void openFill(id);
    },
    [openFill],
  );

  const open = openId ? permits.find((p) => p.id === openId) : undefined;

  const download = async () => {
    if (!open) return;
    const st = filler.forms[open.id];
    if (!st) return;
    try {
      show(
        await exportPdf({
          permitId: open.id,
          title: st.spec?.form_title || open.name,
          facts,
          answers: st.answers,
          strokes: ink.strokesFor(open.id),
        }),
      );
    } catch (err) {
      fail(err);
    }
  };

  const markOpenSent = async () => {
    if (!open) return;
    try {
      const res = await markSent(open.id);
      setSent((prev) => ({ ...prev, [open.id]: fmtDate(res?.sent_at ? new Date(res.sent_at) : new Date()) }));
      filler.log(open.id, { kind: "sent", text: "Sent to " + open.agency, sub: open.channel });
      show(open.name + " marked as sent");
    } catch (err) {
      fail(err);
    }
  };

  return (
    <div className={styles.shell}>
      <Header onBack={openId ? () => setOpenId(null) : undefined} onStartOver={onStartOver} />
      <div className={styles.body}>
        {!result ? (
          <IntakeScreen {...nav} />
        ) : !openId ? (
          <SummaryScreen
            result={result}
            facts={facts}
            known={nav.known}
            permits={permits}
            others={others}
            fillLabel={(id) => (sent[id] ? "Sent" : filler.forms[id] ? "Open" : "Fill for me")}
            onFill={openForm}
          />
        ) : (
          <FillerScreen
            permits={permits}
            forms={filler.forms}
            sent={sent}
            openId={openId}
            facts={facts}
            strokes={ink.strokesFor(openId)}
            onStroke={(s) => ink.add(openId, s)}
            onClearInk={() => ink.clear(openId)}
            onOpen={openForm}
            onAnswer={(text) => filler.answer(openId, text)}
            onEdit={(key, value) => filler.edit(openId, key, value)}
            onDownload={download}
            onMarkSent={markOpenSent}
          />
        )}
      </div>
      <Toast key={toast.id} message={toast.message} />
    </div>
  );
}
