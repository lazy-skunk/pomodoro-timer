import { App } from "./App";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "tailwindcss/index.css";
import "./PomodoroTimer.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
