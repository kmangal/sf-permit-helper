// One run through the app: intake chat, then the list of permits.
// Owns the state both screens share; each screen only renders.

import { useCallback, useMemo } from "react";
import { useNavigator } from "../../hooks/useNavigator.ts";
import { useToast } from "../../hooks/useToast.ts";
import { errorMessage } from "../../lib/api.ts";
import { toOthers, toPermits } from "../../lib/rules.ts";
import { IntakeScreen } from "../intake/IntakeScreen.tsx";
import { SummaryScreen } from "../summary/SummaryScreen.tsx";
import { Toast } from "../ui/Toast.tsx";

export function PermitSession() {
  const { toast, show } = useToast();
  const fail = useCallback((err: unknown) => show(errorMessage(err)), [show]);
  const nav = useNavigator({ onError: fail });
  const { result } = nav;

  const permits = useMemo(() => toPermits(result), [result]);
  const others = useMemo(() => toOthers(result), [result]);

  return (
    <>
      {!result ? (
        <IntakeScreen {...nav} />
      ) : (
        <SummaryScreen result={result} facts={result.facts} permits={permits} others={others} />
      )}
      <Toast key={toast.id} message={toast.message} />
    </>
  );
}
