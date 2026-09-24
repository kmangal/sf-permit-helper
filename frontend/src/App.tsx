import { useState } from "react";
import { PermitSession } from "./components/session/PermitSession.tsx";

/** "Start over" remounts the session, which drops every bit of its state. */
export default function App() {
  const [run, setRun] = useState(0);
  return <PermitSession key={run} onStartOver={() => setRun((n) => n + 1)} />;
}
