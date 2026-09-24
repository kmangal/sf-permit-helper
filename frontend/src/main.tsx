import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Global styles first: component modules must come after them in the bundle,
// or the `.a-*` animation shorthands reset the modules' animation-delay.
import "./styles.css";
import App from "./App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
