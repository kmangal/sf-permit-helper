import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { NotFound } from "./components/layout/NotFound.tsx";
import { Shell } from "./components/layout/Shell.tsx";
import { RulesPage } from "./components/rules/RulesPage.tsx";
import { PermitSession } from "./components/session/PermitSession.tsx";

/** Every page but "not found" sits inside the shared header and footer. */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Helper />} />
          <Route path="rules/:diagramId?" element={<RulesPage />} />
        </Route>
        {/* Bare: no header or small print. */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

/** Each navigation to "/", "Start over" included, remounts the session and drops its state. */
function Helper() {
  const { key } = useLocation();
  return <PermitSession key={key} />;
}
