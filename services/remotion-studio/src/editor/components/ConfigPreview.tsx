// ─── ConfigPreview: JSON preview of current PipelineConfig (D-16) ──────────────
// Read-only JSON view of the current config. Includes copy-to-clipboard button.

import React, { useState } from "react";
import type { PipelineConfig } from "../../pipeline-config.js";

interface ConfigPreviewProps {
  config: PipelineConfig;
}

export function ConfigPreview({ config }: ConfigPreviewProps) {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(config, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement("textarea");
      textarea.value = jsonString;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          onClick={handleCopy}
          style={{
            padding: "4px 12px",
            background: copied ? "#4CAF50" : "#333",
            color: copied ? "#fff" : "#ccc",
            border: "1px solid #555",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {copied ? "✓ Copied" : "Copy JSON"}
        </button>
      </div>
      <pre
        style={{
          background: "#0d1117",
          color: "#c9d1d9",
          padding: 16,
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
          overflowX: "auto",
          border: "1px solid #333",
          margin: 0,
        }}
      >
        {jsonString}
      </pre>
    </div>
  );
}