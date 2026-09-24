import { useCallback, useEffect, useState } from "react";

export const TOAST_MS = 2400;

export interface ToastState {
  message: string;
  /** Bumps on every show, so a repeat message still replays. */
  id: number;
}

/** One transient message at a time; each new one restarts the clock. */
export function useToast(duration = TOAST_MS) {
  const [toast, setToast] = useState<ToastState>({ message: "", id: 0 });

  const show = useCallback((message: string) => {
    setToast((prev) => ({ message, id: prev.id + 1 }));
  }, []);

  useEffect(() => {
    if (!toast.message) return;
    const t = setTimeout(() => setToast((prev) => (prev.id === toast.id ? { ...prev, message: "" } : prev)), duration);
    return () => clearTimeout(t);
  }, [toast, duration]);

  return { toast, show };
}
