import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../style.css";
import "./studio.css";
import { StudioApp } from "./StudioApp.tsx";
import { registerServiceWorker } from "../ui/service-worker.ts";

// The catalog editor is its own page (studio/index.html), with its own
// service worker at /studio/sw.js. It keeps only the editor's own files, so
// the site's worker and its caches are left alone.
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>,
);
