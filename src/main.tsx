import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";

// Must run before the first render so early boot errors are captured.
// No-ops entirely when VITE_SENTRY_DSN is not configured.
initSentry();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
