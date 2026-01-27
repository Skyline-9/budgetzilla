import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { DatabaseProvider } from "./providers/DatabaseProvider";
import "./index.css";

// Detect Tauri platform for safe area handling
if ("__TAURI_INTERNALS__" in window) {
  import("@tauri-apps/plugin-os").then(({ platform }) => {
    const p = platform();
    if (p === "macos") {
      document.body.classList.add("tauri-macos");
    } else if (p === "ios") {
      document.body.classList.add("tauri-ios");
    }
  }).catch(() => {
    // Fallback: check user agent
    if (navigator.userAgent.includes("Mac")) {
      document.body.classList.add("tauri-macos");
    } else if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      document.body.classList.add("tauri-ios");
    }
  });
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <DatabaseProvider>
      <App />
    </DatabaseProvider>
  </React.StrictMode>
);
