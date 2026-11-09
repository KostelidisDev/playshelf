import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../style.css";
import "./studio.css";
import { StudioApp } from "./StudioApp.tsx";

// The catalog editor is its own page (studio/index.html), so it doesn't
// register the service worker: it's a tool to use online, not an offline site.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>,
);
