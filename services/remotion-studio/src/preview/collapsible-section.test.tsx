/**
 * collapsible-section.test.tsx — Phase 29 Plan 01, Tasks 1 & 2 (TDD)
 *
 * Tests the reusable CollapsibleSection disclosure component.
 * Uses vitest + @testing-library/react (mirrors metadata-panel.test.tsx idiom).
 *
 * Coverage (FONT-01 / FONT-02 disclosure contract):
 *  - defaultOpen omitted → body absent from the document on mount (default-collapsed)
 *  - Clicking the header (by accessible name) reveals the body
 *  - Clicking again hides it (toggle closed)
 *  - defaultOpen={true} → body present on mount
 *  - aria-expanded reflects state (false collapsed, true expanded)
 *  - Green discipline: header queryable as a button named by `title`
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollapsibleSection } from "./CollapsibleSection.js";

const BODY = "SECTION_BODY";

describe("CollapsibleSection", () => {
  it("is collapsed by default — body absent on mount when defaultOpen omitted", () => {
    render(
      <CollapsibleSection title="Sample text">
        <div>{BODY}</div>
      </CollapsibleSection>
    );
    expect(screen.queryByText(BODY)).toBeNull();
  });

  it("exposes a header button whose accessible name equals the title", () => {
    render(
      <CollapsibleSection title="Sample text">
        <div>{BODY}</div>
      </CollapsibleSection>
    );
    const header = screen.getByRole("button", { name: /Sample text/i });
    expect(header).toBeTruthy();
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });

  it("reveals the body when the header is clicked, hides it on the second click", () => {
    render(
      <CollapsibleSection title="Sample text">
        <div>{BODY}</div>
      </CollapsibleSection>
    );
    const header = screen.getByRole("button", { name: /Sample text/i });

    // collapsed → expanded
    fireEvent.click(header);
    expect(screen.queryByText(BODY)).not.toBeNull();
    expect(header.getAttribute("aria-expanded")).toBe("true");

    // expanded → collapsed
    fireEvent.click(header);
    expect(screen.queryByText(BODY)).toBeNull();
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders the body on mount when defaultOpen={true}", () => {
    render(
      <CollapsibleSection title="Browse Fonts" defaultOpen>
        <div>{BODY}</div>
      </CollapsibleSection>
    );
    expect(screen.queryByText(BODY)).not.toBeNull();
    const header = screen.getByRole("button", { name: /Browse Fonts/i });
    expect(header.getAttribute("aria-expanded")).toBe("true");
  });
});
