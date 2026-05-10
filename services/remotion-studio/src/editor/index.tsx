// ─── Config Editor SPA Entry Point ──────────────────────────────────────────
// Bootstraps the React app into the #root div. Per D-16: config editor SPA that
// writes pipeline-config.json via PUT /api/config and drives Remotion Studio preview.

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);