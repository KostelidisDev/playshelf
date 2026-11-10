import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { HistoryRouter } from "./lib/history.ts";
import { registerServiceWorker } from "./ui/service-worker.ts";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App router={new HistoryRouter()} />
    </ErrorBoundary>
  </StrictMode>,
);

// Production builds only: under `vite dev`, a worker caching the dev
// server's files would only get in the way.
if (import.meta.env.PROD) registerServiceWorker();
