import { Outlet } from "react-router";
import { Disclaimer } from "./Disclaimer.tsx";
import { Header } from "./Header.tsx";
import styles from "./Shell.module.css";

/** The frame around every page: header, the page itself, small print. */
export function Shell() {
  return (
    <div className={styles.shell}>
      <Header />
      <div className={styles.body}>
        <Outlet />
      </div>
      <Disclaimer />
    </div>
  );
}
