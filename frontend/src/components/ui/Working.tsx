import { Dots } from "./Dots.tsx";
import styles from "./Working.module.css";

/** Dots and a line saying what is happening. */
export function Working({ children, className }: { children: string; className?: string }) {
  return (
    <div className={[styles.working, className].filter(Boolean).join(" ")} role="status">
      <Dots />
      <span>{children}</span>
    </div>
  );
}
