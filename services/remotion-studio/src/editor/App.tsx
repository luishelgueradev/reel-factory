// ─── Remotion Studio: Single-route React Router (18-03 D-02) ──────────────────
// Unified studio: / → PreviewApp (StudioApp). All old routes 301-redirect at the
// server layer (server.ts). No /editor or /preview routes here.

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PreviewApp } from "../preview/PreviewApp.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PreviewApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
