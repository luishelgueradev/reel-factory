// ─── Remotion Studio: Main App with React Router (D-02) ──────────────────────
// Per D-02: Single SPA with routing — /editor and /preview coexist in the same Vite build.
// React Router switches between EditorApp and PreviewApp.

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { EditorApp } from "./EditorApp.js";
import { PreviewApp } from "../preview/PreviewApp.js";
import { FontGridPage } from "../preview/FontGridPage.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/editor" element={<EditorApp />} />
        <Route path="/editor/*" element={<EditorApp />} />
        <Route path="/preview/fonts" element={<FontGridPage />} />
        <Route path="/preview" element={<PreviewApp />} />
        <Route path="/" element={<Navigate to="/editor" replace />} />
        <Route path="*" element={<Navigate to="/editor" replace />} />
      </Routes>
    </BrowserRouter>
  );
}