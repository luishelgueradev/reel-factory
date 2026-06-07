// ─── TextareaInput: Editable sample text (D-11) ─────────────────────────────────
// Provides an editable textarea with Spanish default text and debounced onChange
// that converts text to TikTokPage[] via textToCaptionPages().

import React, { useCallback, useState, useRef, useEffect } from "react";

interface TextareaInputProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export function TextareaInput({ value, onChange, placeholder }: TextareaInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Item 6 (260607-uzv-03): inner sample-text label removed — the wrapping
          CollapsibleSection (PreviewApp) owns the heading, so the inner label was
          a duplicate. Helper text below is kept. */}
      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
        Edit the text below. Words will cycle through subtitles in the preview.
      </p>
      <textarea
        value={value}
        onChange={handleChange}
        style={{
          width: "100%",
          minHeight: 120,
          padding: "12px 16px",
          background: "#1e1e2e",
          color: "#e0e0e0",
          border: "1px solid #444",
          borderRadius: 8,
          fontSize: 14,
          lineHeight: 1.6,
          resize: "vertical",
          fontFamily: "inherit",
        }}
        placeholder={placeholder ?? "Type your subtitle text here..."}
      />
    </div>
  );
}