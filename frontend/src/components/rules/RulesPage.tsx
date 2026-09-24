// /rules and /rules/:diagramId: the flowcharts behind the helper, for anyone
// who wants to check its work. Each diagram has its own URL so it can be linked to.

import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { useMermaidSvg, useRuleDiagrams } from "../../hooks/useRuleDiagrams.ts";
import { RulesScreen } from "./RulesScreen.tsx";
import styles from "./RulesScreen.module.css";

export function RulesPage() {
  const { diagramId } = useParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const diagrams = useRuleDiagrams();

  const list = diagrams.status === "ready" ? diagrams.value : [];
  const selected = diagramId ? list.find((d) => d.id === diagramId) : list[0];
  const svg = useMermaidSvg(selected?.source);

  // Links from before diagrams had paths: /rules#04_street_or_sidewalk.
  if (!diagramId && hash) return <Navigate to={"/rules/" + hash.slice(1)} replace />;
  // An id that names no diagram falls back to the overview.
  if (diagrams.status === "ready" && diagramId && !selected) return <Navigate to="/rules" replace />;

  if (!selected) {
    return (
      <div className={styles.screen}>
        <p className={styles.note} role={diagrams.status === "error" ? "alert" : undefined}>
          {diagrams.status === "error" ? "Could not load the rules: " + diagrams.message : "Loading the rules…"}
        </p>
      </div>
    );
  }

  return (
    <RulesScreen
      diagrams={list}
      selected={selected}
      svg={svg}
      // Replace, so Back leaves the page rather than stepping through tabs.
      onSelect={(id) => navigate("/rules/" + encodeURIComponent(id), { replace: true })}
    />
  );
}
