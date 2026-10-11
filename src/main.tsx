import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App.tsx";
import { HistoryRouter } from "./lib/history.ts";
import { registerServiceWorker } from "./ui/service-worker.ts";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App router={new HistoryRouter()} />
  </StrictMode>,
);

// Production builds only: under `vite dev`, a worker caching the dev
// server's files would only get in the way.
if (import.meta.env.PROD) registerServiceWorker();
