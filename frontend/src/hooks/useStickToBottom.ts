import { useEffect, useRef } from "react";

// Within this many pixels of the bottom counts as "at the bottom".
const NEAR = 80;

/**
 * Keeps a scroll container at its bottom as its content grows — new messages, streamed
 * text, the footer taking more room — scrolling smoothly. Scrolling up to read lets go;
 * scrolling back down, or a change in `pin`, takes hold again.
 */
export function useStickToBottom<S extends HTMLElement, C extends HTMLElement>(pin: unknown) {
  const scroller = useRef<S>(null);
  const content = useRef<C>(null);
  const stuck = useRef(true);

  useEffect(() => {
    stuck.current = true;
  }, [pin]);

  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner || typeof ResizeObserver === "undefined") return;

    let last = el.scrollTop;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      // Our own scrolling only goes down, so moving up is the reader.
      if (gap < NEAR) stuck.current = true;
      else if (el.scrollTop < last) stuck.current = false;
      last = el.scrollTop;
    };

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const follow = () => {
      if (stuck.current) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
    };

    const observer = new ResizeObserver(follow);
    observer.observe(inner);
    observer.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  return { scroller, content };
}
