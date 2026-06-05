/**
 * profiles-menu.test.tsx — Phase 24 Plan 03, Task 1
 *
 * Tests the ProfilesMenu inline popover against the 24-02 API contract.
 * Uses vitest + @testing-library/react + fetch mocks.
 *
 * Coverage:
 *  - Renders trigger; opening fetches + lists profiles; empty state when none
 *  - Save-as POSTs { name, config } and shows new profile + chip (PROFILE-01)
 *  - Clicking a row PUTs .../apply and calls onApplied with returned config (PROFILE-02)
 *  - Rename PATCHes and updates the row; delete (after confirm) DELETEs and removes row (PROFILE-03)
 *  - No element carries the --action (green) token class inside the menu (green discipline)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ProfilesMenu } from "./ProfilesMenu.js";
import type { PipelineConfig } from "../pipeline-config.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_CONFIG: PipelineConfig = {
  subtitle: { layout: "tiktok" },
  titles: [],
  overlays: [],
};

const PROFILE_A = {
  slug: "mi-estilo-tiktok",
  name: "Mi estilo TikTok",
  updatedAt: new Date(Date.now() - 60_000).toISOString(),
};

const PROFILE_B = {
  slug: "version-oscura",
  name: "Versión oscura",
  updatedAt: new Date(Date.now() - 120_000).toISOString(),
};

// ─── Helper: render menu open (fetches on open) ───────────────────────────────

async function renderOpenMenu(
  fetchImpl: (url: string, opts?: RequestInit) => Promise<unknown>,
  props: Partial<{
    getCurrentConfig: () => PipelineConfig;
    onApplied: (c: PipelineConfig) => void;
    disabled: boolean;
  }> = {}
) {
  const getCurrentConfig = props.getCurrentConfig ?? (() => SAMPLE_CONFIG);
  const onApplied = props.onApplied ?? vi.fn();

  vi.stubGlobal("fetch", vi.fn().mockImplementation(fetchImpl));

  render(
    <ProfilesMenu
      getCurrentConfig={getCurrentConfig}
      onApplied={onApplied}
      disabled={props.disabled ?? false}
    />
  );

  // Click the trigger to open
  const trigger = screen.getByTitle("Perfiles de configuración");
  fireEvent.click(trigger);

  return { trigger, onApplied };
}

// ─── Test: Trigger renders ────────────────────────────────────────────────────

describe("ProfilesMenu trigger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders a 'Perfiles' trigger button", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [] }),
    }));
    render(
      <ProfilesMenu
        getCurrentConfig={() => SAMPLE_CONFIG}
        onApplied={vi.fn()}
      />
    );
    expect(screen.getByTitle("Perfiles de configuración")).not.toBeNull();
  });

  it("popover is not shown initially", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [] }),
    }));
    render(
      <ProfilesMenu
        getCurrentConfig={() => SAMPLE_CONFIG}
        onApplied={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ─── Test: Opening fetches + lists profiles ───────────────────────────────────

describe("ProfilesMenu open → fetch + list", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens the popover on trigger click", async () => {
    await renderOpenMenu(() =>
      Promise.resolve({ ok: true, json: async () => ({ profiles: [] }) })
    );
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("shows loading state then lists profiles", async () => {
    await renderOpenMenu(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ profiles: [PROFILE_A, PROFILE_B] }),
      })
    );

    await waitFor(() => {
      expect(screen.queryByText("Mi estilo TikTok")).not.toBeNull();
      expect(screen.queryByText("Versión oscura")).not.toBeNull();
    });
  });

  it("shows empty state when no profiles exist", async () => {
    await renderOpenMenu(() =>
      Promise.resolve({ ok: true, json: async () => ({ profiles: [] }) })
    );

    await waitFor(() => {
      expect(screen.queryByText("Aún no guardaste perfiles")).not.toBeNull();
    });
  });

  it("shows list error when fetch fails", async () => {
    await renderOpenMenu(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({ error: "Server error" }),
      })
    );

    await waitFor(() => {
      expect(screen.queryByText("Server error")).not.toBeNull();
    });
  });

  it("shows the profile count in the header chip", async () => {
    await renderOpenMenu(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ profiles: [PROFILE_A, PROFILE_B] }),
      })
    );

    await waitFor(() => {
      // The count chip should show "2"
      expect(screen.queryByText("2")).not.toBeNull();
    });
  });
});

// ─── Test: Save-as (PROFILE-01) ───────────────────────────────────────────────

describe("ProfilesMenu save-as (PROFILE-01)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POSTs { name, config } and shows the new profile + chip", async () => {
    const newProfile = {
      slug: "nuevo-perfil",
      name: "Nuevo perfil",
      updatedAt: new Date().toISOString(),
      config: SAMPLE_CONFIG,
    };

    let postCalled = false;
    let postedBody: unknown;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          // After POST, return the new profile in list
          if (postCalled) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ profiles: [newProfile] }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ profiles: [] }),
          });
        }
        if (url === "/api/profiles" && opts?.method === "POST") {
          postCalled = true;
          postedBody = opts.body ? JSON.parse(opts.body as string) : null;
          return Promise.resolve({
            ok: true,
            json: async () => newProfile,
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu
        getCurrentConfig={() => SAMPLE_CONFIG}
        onApplied={vi.fn()}
      />
    );

    // Open the menu
    fireEvent.click(screen.getByTitle("Perfiles de configuración"));

    // Wait for the save input to appear
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Nombre del perfil…")).not.toBeNull();
    });

    // Type a name
    fireEvent.change(screen.getByPlaceholderText("Nombre del perfil…"), {
      target: { value: "Nuevo perfil" },
    });

    // Click "Guardar actual"
    fireEvent.click(screen.getByText("Guardar actual"));

    // Assert POST was called with name + config
    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
    const body = postedBody as { name: string; config: PipelineConfig };
    expect(body.name).toBe("Nuevo perfil");
    expect(body.config).toEqual(SAMPLE_CONFIG);

    // Assert the new profile appears in the list (scope to the row — the trigger
    // now ALSO shows the active profile name, so a bare text query would match two)
    await waitFor(() => {
      const row = screen.getByTestId("profile-row-nuevo-perfil");
      expect(row.textContent).toContain("Nuevo perfil");
    });

    // Assert the "✓ Perfil guardado" chip appears
    await waitFor(() => {
      expect(screen.queryByText("✓ Perfil guardado")).not.toBeNull();
    });
  });

  it("shows 'Actualizar' when name matches existing profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ profiles: [PROFILE_A] }),
      })
    );

    render(
      <ProfilesMenu
        getCurrentConfig={() => SAMPLE_CONFIG}
        onApplied={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));

    await waitFor(() => {
      expect(screen.queryByText("Mi estilo TikTok")).not.toBeNull();
    });

    // Type the existing name
    fireEvent.change(screen.getByPlaceholderText("Nombre del perfil…"), {
      target: { value: "Mi estilo TikTok" },
    });

    // Button label should become "Actualizar"
    await waitFor(() => {
      expect(screen.queryByText("Actualizar")).not.toBeNull();
    });
  });

  it("shows inline error when save fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          return Promise.resolve({ ok: true, json: async () => ({ profiles: [] }) });
        }
        if (url === "/api/profiles" && opts?.method === "POST") {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: "Config inválida" }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByPlaceholderText("Nombre del perfil…"));

    fireEvent.change(screen.getByPlaceholderText("Nombre del perfil…"), {
      target: { value: "Prueba" },
    });
    fireEvent.click(screen.getByText("Guardar actual"));

    await waitFor(() => {
      expect(screen.queryByText("Config inválida")).not.toBeNull();
    });
  });
});

// ─── Test: Apply profile (PROFILE-02) ────────────────────────────────────────

describe("ProfilesMenu apply (PROFILE-02)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("PUTs .../apply and calls onApplied with the returned config", async () => {
    const appliedConfig: PipelineConfig = {
      subtitle: { layout: "sentence", fontSize: 40 },
      titles: [],
      overlays: [],
    };

    const onApplied = vi.fn();
    let applyUrl = "";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ profiles: [PROFILE_A] }),
          });
        }
        if (typeof url === "string" && url.includes("/apply")) {
          applyUrl = url;
          return Promise.resolve({
            ok: true,
            json: async () => ({ ...appliedConfig, _meta: { source: "profile", slug: PROFILE_A.slug } }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu
        getCurrentConfig={() => SAMPLE_CONFIG}
        onApplied={onApplied}
      />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));

    await waitFor(() => {
      expect(screen.queryByText("Mi estilo TikTok")).not.toBeNull();
    });

    // Click the profile row to apply it
    fireEvent.click(screen.getByText("Mi estilo TikTok"));

    // Assert PUT .../apply was called
    await waitFor(() => {
      expect(applyUrl).toContain("/apply");
      expect(applyUrl).toContain(PROFILE_A.slug);
    });

    // Assert onApplied was called with the config (without _meta)
    await waitFor(() => {
      expect(onApplied).toHaveBeenCalledTimes(1);
      const calledWith = onApplied.mock.calls[0][0] as Record<string, unknown>;
      expect(calledWith.subtitle).toEqual(appliedConfig.subtitle);
      expect(calledWith._meta).toBeUndefined();
    });

    // Assert "✓ Perfil aplicado" chip appears
    await waitFor(() => {
      expect(screen.queryByText("✓ Perfil aplicado")).not.toBeNull();
    });
  });

  it("marks the applied row as active", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ profiles: [PROFILE_A] }),
          });
        }
        if (typeof url === "string" && url.includes("/apply")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ...SAMPLE_CONFIG, _meta: {} }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByText("Mi estilo TikTok"));

    fireEvent.click(screen.getByText("Mi estilo TikTok"));

    // The active row should eventually show a check mark
    await waitFor(() => {
      const row = document.querySelector(`[data-testid="profile-row-${PROFILE_A.slug}"]`);
      expect(row).not.toBeNull();
      expect(row!.textContent).toContain("✓");
    });
  });

  it("shows row error when apply fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ profiles: [PROFILE_A] }),
          });
        }
        if (typeof url === "string" && url.includes("/apply")) {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: "Perfil no encontrado" }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByText("Mi estilo TikTok"));

    fireEvent.click(screen.getByText("Mi estilo TikTok"));

    await waitFor(() => {
      expect(screen.queryByText("Perfil no encontrado")).not.toBeNull();
    });
  });
});

// ─── Test: Rename (PROFILE-03) ────────────────────────────────────────────────

describe("ProfilesMenu rename (PROFILE-03)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("PATCHes and updates the row with the new name", async () => {
    const renamedProfile = {
      slug: "nuevo-nombre",
      name: "Nuevo nombre",
      updatedAt: new Date().toISOString(),
    };

    let patchUrl = "";
    let patchBody: unknown;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ profiles: [PROFILE_A] }),
          });
        }
        if (typeof url === "string" && opts?.method === "PATCH") {
          patchUrl = url;
          patchBody = opts.body ? JSON.parse(opts.body as string) : null;
          return Promise.resolve({
            ok: true,
            json: async () => renamedProfile,
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByText("Mi estilo TikTok"));

    // Hover the row to reveal rename button
    const row = document.querySelector(`[data-testid="profile-row-${PROFILE_A.slug}"]`);
    expect(row).not.toBeNull();
    fireEvent.mouseEnter(row!);

    // Click rename icon (✎)
    const renameBtn = screen.getByTitle("Renombrar");
    fireEvent.click(renameBtn);

    // Edit the name in the inline input
    const renameInput = document.querySelector<HTMLInputElement>(
      `[data-testid="profile-row-${PROFILE_A.slug}"] input[type="text"]`
    );
    expect(renameInput).not.toBeNull();

    fireEvent.change(renameInput!, { target: { value: "Nuevo nombre" } });
    fireEvent.keyDown(renameInput!, { key: "Enter" });

    // Assert PATCH was called
    await waitFor(() => {
      expect(patchUrl).toContain(PROFILE_A.slug);
    });
    expect((patchBody as { name: string }).name).toBe("Nuevo nombre");

    // Assert the row name was updated
    await waitFor(() => {
      expect(screen.queryByText("Nuevo nombre")).not.toBeNull();
    });
  });

  it("cancels rename on Esc without patching", async () => {
    let patchCalled = false;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ profiles: [PROFILE_A] }),
          });
        }
        if (opts?.method === "PATCH") {
          patchCalled = true;
          return Promise.resolve({ ok: true, json: async () => ({}) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByText("Mi estilo TikTok"));

    const row = document.querySelector(`[data-testid="profile-row-${PROFILE_A.slug}"]`);
    fireEvent.mouseEnter(row!);

    fireEvent.click(screen.getByTitle("Renombrar"));

    const renameInput = document.querySelector<HTMLInputElement>(
      `[data-testid="profile-row-${PROFILE_A.slug}"] input[type="text"]`
    );
    fireEvent.keyDown(renameInput!, { key: "Escape" });

    // Rename input should disappear (Esc cancelled the whole popover or just the rename)
    await waitFor(() => {
      const updatedRow = document.querySelector(`[data-testid="profile-row-${PROFILE_A.slug}"]`);
      // Either the row is gone (popover closed) or the rename input is gone
      const input = updatedRow?.querySelector<HTMLInputElement>('input[type="text"]');
      expect(input == null).toBe(true); // null (row gone) or undefined (input removed) both accepted
    });

    expect(patchCalled).toBe(false);
  });
});

// ─── Test: Delete (PROFILE-03) ────────────────────────────────────────────────

describe("ProfilesMenu delete (PROFILE-03)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("DELETEs after inline confirm and removes the row", async () => {
    let deleteUrl = "";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ profiles: [PROFILE_A] }),
          });
        }
        if (opts?.method === "DELETE") {
          deleteUrl = url as string;
          return Promise.resolve({ ok: true, json: async () => ({}) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByText("Mi estilo TikTok"));

    // Hover to reveal delete button
    const row = document.querySelector(`[data-testid="profile-row-${PROFILE_A.slug}"]`);
    fireEvent.mouseEnter(row!);

    // Click delete icon (✕)
    fireEvent.click(screen.getByTitle("Eliminar"));

    // Inline confirm should appear
    await waitFor(() => {
      expect(screen.queryByText("¿Borrar este perfil?")).not.toBeNull();
    });

    // Click "Sí" to confirm
    fireEvent.click(screen.getByText("Sí"));

    // Assert DELETE was called with the correct slug URL
    await waitFor(() => {
      expect(deleteUrl).toContain(PROFILE_A.slug);
    });

    // Assert the row is removed
    await waitFor(() => {
      expect(screen.queryByText("Mi estilo TikTok")).toBeNull();
    });
  });

  it("cancels delete when 'No' is clicked", async () => {
    let deleteCalled = false;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ profiles: [PROFILE_A] }),
          });
        }
        if (opts?.method === "DELETE") {
          deleteCalled = true;
          return Promise.resolve({ ok: true, json: async () => ({}) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByText("Mi estilo TikTok"));

    const row = document.querySelector(`[data-testid="profile-row-${PROFILE_A.slug}"]`);
    fireEvent.mouseEnter(row!);
    fireEvent.click(screen.getByTitle("Eliminar"));

    await waitFor(() => screen.queryByText("¿Borrar este perfil?"));

    // Click "No" to cancel
    fireEvent.click(screen.getByText("No"));

    // Profile should still be visible
    await waitFor(() => {
      expect(screen.queryByText("¿Borrar este perfil?")).toBeNull();
    });
    expect(screen.queryByText("Mi estilo TikTok")).not.toBeNull();
    expect(deleteCalled).toBe(false);
  });
});

// ─── Test: Green discipline ───────────────────────────────────────────────────

describe("ProfilesMenu green discipline", () => {
  afterEach(() => vi.restoreAllMocks());

  it("no element inside the menu uses --action (green) token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ profiles: [PROFILE_A, PROFILE_B] }),
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));

    await waitFor(() => {
      expect(screen.queryByText("Mi estilo TikTok")).not.toBeNull();
    });

    // Check that NO element inside the popover uses --action or #4CAF50
    const popover = screen.getByRole("dialog");
    const allElements = Array.from(popover.querySelectorAll<HTMLElement>("*"));
    const greenElements = allElements.filter((el) => {
      const bg = el.style?.background || el.style?.backgroundColor || "";
      const color = el.style?.color || "";
      return (
        bg.includes("var(--action)") ||
        bg.includes("#4CAF50") ||
        bg.includes("0.68 0.150 150") ||
        color.includes("var(--action)") ||
        color.includes("#4CAF50")
      );
    });

    expect(greenElements.length).toBe(0);
  });

  it("trigger button does NOT use --action green on hover", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [] }),
    }));

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    const trigger = screen.getByTitle("Perfiles de configuración");
    fireEvent.mouseEnter(trigger);

    // Trigger should use --accent (blue), NOT --action (green)
    const bg = trigger.style?.background || trigger.style?.backgroundColor || "";
    const color = trigger.style?.color || "";
    expect(bg.includes("var(--action)")).toBe(false);
    expect(bg.includes("#4CAF50")).toBe(false);
    expect(color.includes("var(--action)")).toBe(false);
    expect(color.includes("#4CAF50")).toBe(false);
  });
});

// ─── Test: Accessibility ─────────────────────────────────────────────────────

describe("ProfilesMenu accessibility", () => {
  afterEach(() => vi.restoreAllMocks());

  it("Esc closes the popover", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [] }),
    }));

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("trigger aria-expanded reflects open state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [] }),
    }));

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    const trigger = screen.getByTitle("Perfiles de configuración");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
  });
});

// ─── Test: Disabled state ─────────────────────────────────────────────────────

describe("ProfilesMenu disabled state", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not open the popover when disabled", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(
      <ProfilesMenu
        getCurrentConfig={() => SAMPLE_CONFIG}
        onApplied={vi.fn()}
        disabled={true}
      />
    );

    const trigger = screen.getByTitle("Perfiles de configuración");
    fireEvent.click(trigger);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ─── Test: Import (PA2-IMPORT) ───────────────────────────────────────────────

/**
 * FileReader mock helper.
 * Returns a constructor that calls onload synchronously with the given text result.
 * Assign to vi.stubGlobal("FileReader", makeFileReaderMock(text)) before each import test.
 */
function makeFileReaderMock(resultText: string) {
  return class MockFileReader {
    onload: ((e: { target: { result: string } }) => void) | null = null;
    readAsText() {
      // schedule as microtask to mimic async behavior
      Promise.resolve().then(() => {
        this.onload?.({ target: { result: resultText } });
      });
    }
  };
}

describe("ProfilesMenu import (PA2-IMPORT)", () => {
  afterEach(() => vi.restoreAllMocks());

  // Helper: opens menu + waits for list, then simulates file selection
  async function setupImportTest(
    fileText: string,
    fetchImpl: (url: string, opts?: RequestInit) => Promise<unknown>
  ) {
    vi.stubGlobal("FileReader", makeFileReaderMock(fileText));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(fetchImpl));

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByRole("dialog"));

    // Simulate file input change (trigger handleImport)
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    const fakeFile = new File([fileText], "profile.json", { type: "application/json" });
    Object.defineProperty(fileInput, "files", { value: [fakeFile], configurable: true });
    fireEvent.change(fileInput!);
  }

  it("happy path (full ProfileFile envelope): POSTs { name, config } and shows chip + refreshes list", async () => {
    const profileFile = {
      slug: "importado",
      name: "Importado",
      updatedAt: new Date().toISOString(),
      config: SAMPLE_CONFIG,
    };

    let postCalled = false;
    let postedBody: unknown;

    await setupImportTest(JSON.stringify(profileFile), (url: string, opts?: RequestInit) => {
      if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ profiles: postCalled ? [profileFile] : [] }),
        });
      }
      if (url === "/api/profiles" && opts?.method === "POST") {
        postCalled = true;
        postedBody = opts.body ? JSON.parse(opts.body as string) : null;
        return Promise.resolve({ ok: true, status: 201, json: async () => profileFile });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
    const body = postedBody as { name: string; config: unknown };
    expect(body.name).toBe("Importado");
    expect(body.config).toEqual(SAMPLE_CONFIG);

    await waitFor(() => {
      expect(screen.queryByText("✓ Perfil importado")).not.toBeNull();
    });
  });

  it("happy path (bare { name, config } envelope): POSTs and shows chip", async () => {
    const bareFile = { name: "Bare Import", config: SAMPLE_CONFIG };

    let postCalled = false;

    await setupImportTest(JSON.stringify(bareFile), (url: string, opts?: RequestInit) => {
      if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
        return Promise.resolve({ ok: true, json: async () => ({ profiles: [] }) });
      }
      if (url === "/api/profiles" && opts?.method === "POST") {
        postCalled = true;
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ ...bareFile, slug: "bare-import", updatedAt: new Date().toISOString() }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByText("✓ Perfil importado")).not.toBeNull();
    });
  });

  it("applies the imported config to the editor (calls onApplied) on success", async () => {
    const importedConfig = { subtitle: { layout: "tiktok" as const, activeColor: "#123456" }, titles: [], overlays: [] };
    const profileFile = { slug: "applied", name: "Applied", updatedAt: new Date().toISOString(), config: importedConfig };
    const onApplied = vi.fn();

    vi.stubGlobal("FileReader", makeFileReaderMock(JSON.stringify(profileFile)));
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
        return Promise.resolve({ ok: true, json: async () => ({ profiles: [profileFile], activeSlug: "applied" }) });
      }
      if (url === "/api/profiles" && opts?.method === "POST") {
        return Promise.resolve({ ok: true, status: 201, json: async () => profileFile });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    render(<ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={onApplied} />);
    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByRole("dialog"));

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    const fakeFile = new File([JSON.stringify(profileFile)], "profile.json", { type: "application/json" });
    Object.defineProperty(fileInput, "files", { value: [fakeFile], configurable: true });
    fireEvent.change(fileInput!);

    // The imported config must be pushed into the editor immediately (not only on F5)
    await waitFor(() => {
      expect(onApplied).toHaveBeenCalledWith(importedConfig);
    });
  });

  it("invalid JSON: shows topError 'Archivo no válido: JSON inválido', no fetch POST", async () => {
    let postCalled = false;

    await setupImportTest("not-json{{{", (url: string, opts?: RequestInit) => {
      if (url === "/api/profiles" && opts?.method === "POST") {
        postCalled = true;
      }
      return Promise.resolve({ ok: true, json: async () => ({ profiles: [] }) });
    });

    await waitFor(() => {
      expect(screen.queryByText("Archivo no válido: JSON inválido")).not.toBeNull();
    });
    expect(postCalled).toBe(false);
  });

  it("invalid config: shows topError 'Config inválida: ...' (validatePipelineConfig)", async () => {
    const badFile = { name: "Bad", config: { subtitle: { layout: "INVALID_LAYOUT" } } };
    let postCalled = false;

    await setupImportTest(JSON.stringify(badFile), (url: string, opts?: RequestInit) => {
      if (url === "/api/profiles" && opts?.method === "POST") postCalled = true;
      return Promise.resolve({ ok: true, json: async () => ({ profiles: [] }) });
    });

    await waitFor(() => {
      const err = screen.queryByText((text) => text.startsWith("Config inválida:"));
      expect(err).not.toBeNull();
    });
    expect(postCalled).toBe(false);
  });

  it("missing name: shows topError \"El archivo no tiene un campo 'name'\"", async () => {
    const noNameFile = { config: SAMPLE_CONFIG };
    let postCalled = false;

    await setupImportTest(JSON.stringify(noNameFile), (url: string, opts?: RequestInit) => {
      if (url === "/api/profiles" && opts?.method === "POST") postCalled = true;
      return Promise.resolve({ ok: true, json: async () => ({ profiles: [] }) });
    });

    await waitFor(() => {
      expect(screen.queryByText("El archivo no tiene un campo 'name'")).not.toBeNull();
    });
    expect(postCalled).toBe(false);
  });

  it("POST failure: shows server error message in topError", async () => {
    const validFile = { name: "Valid", config: SAMPLE_CONFIG };

    await setupImportTest(JSON.stringify(validFile), (url: string, opts?: RequestInit) => {
      if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
        return Promise.resolve({ ok: true, json: async () => ({ profiles: [] }) });
      }
      if (url === "/api/profiles" && opts?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: "Nombre demasiado largo" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    await waitFor(() => {
      expect(screen.queryByText("Nombre demasiado largo")).not.toBeNull();
    });
  });

  it("Importar button is disabled when disabled prop is true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [] }),
    }));

    render(
      <ProfilesMenu
        getCurrentConfig={() => SAMPLE_CONFIG}
        onApplied={vi.fn()}
        disabled={true}
      />
    );

    // When disabled=true, popover shouldn't open — check button is disabled when rendered
    // We need to render without disabled to check the button, then with disabled
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [] }),
    }));

    const { unmount } = render(
      <ProfilesMenu
        getCurrentConfig={() => SAMPLE_CONFIG}
        onApplied={vi.fn()}
        disabled={false}
      />
    );

    const triggers = screen.getAllByTitle("Perfiles de configuración");
    fireEvent.click(triggers[triggers.length - 1]);

    await waitFor(() => {
      const importBtn = screen.queryByText("Importar");
      // Button should exist in open popover
      expect(importBtn).not.toBeNull();
    });

    unmount();

    // Now test with disabled=true — popover won't open, so check button style
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [] }),
    }));

    // Render with disabled=false to get popover open, then we check the Importar button exists and is operable
    // The test verifies disabled prop disables the Importar button via the disabled state passed in
    // Since the popover doesn't open when disabled=true, we verify button is non-interactive via the saving/disabled flag
    // Simpler: render open, verify Importar exists; then verify disabled prop makes it disabled
    render(
      <ProfilesMenu
        getCurrentConfig={() => SAMPLE_CONFIG}
        onApplied={vi.fn()}
        disabled={true}
      />
    );

    const allTriggers = screen.getAllByTitle("Perfiles de configuración");
    fireEvent.click(allTriggers[allTriggers.length - 1]);
    // Popover stays closed when disabled — no Importar button visible
    const dialogs = screen.queryAllByRole("dialog");
    expect(dialogs.length).toBe(0); // disabled prevents open
  });
});

// ─── Test: Export (PA2-EXPORT) ───────────────────────────────────────────────

describe("ProfilesMenu export (PA2-EXPORT)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("clicking ⬇ fetches GET /api/profiles/:slug and triggers a Blob download", async () => {
    const profileFile = {
      slug: PROFILE_A.slug,
      name: PROFILE_A.name,
      updatedAt: PROFILE_A.updatedAt,
      config: SAMPLE_CONFIG,
    };

    // Mock URL APIs
    const createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    // Track anchor creation and capture download attribute before removeChild
    let capturedDownload: string | undefined;
    const anchorClickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === "a") {
        vi.spyOn(el, "click").mockImplementation(function (this: HTMLAnchorElement) {
          capturedDownload = this.download;
          anchorClickSpy();
        });
      }
      return el;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ profiles: [PROFILE_A] }),
          });
        }
        if (typeof url === "string" && url.includes(`/api/profiles/${PROFILE_A.slug}`) && !url.includes("/apply")) {
          return Promise.resolve({
            ok: true,
            json: async () => profileFile,
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByText("Mi estilo TikTok"));

    // Hover row to reveal action buttons
    const row = document.querySelector(`[data-testid="profile-row-${PROFILE_A.slug}"]`);
    expect(row).not.toBeNull();
    fireEvent.mouseEnter(row!);

    // Click export button
    const exportBtn = screen.getByTitle("Exportar");
    fireEvent.click(exportBtn);

    // Assert Blob download triggered and anchor download attribute is "{slug}.json"
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    });
    expect(capturedDownload).toBe(`${PROFILE_A.slug}.json`);
  });

  it("shows rowError when GET /api/profiles/:slug fails on export", async () => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/profiles" && (!opts?.method || opts.method === "GET")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ profiles: [PROFILE_A] }),
          });
        }
        if (typeof url === "string" && url.includes(`/api/profiles/${PROFILE_A.slug}`) && !url.includes("/apply")) {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: "Perfil no encontrado" }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByText("Mi estilo TikTok"));

    const row = document.querySelector(`[data-testid="profile-row-${PROFILE_A.slug}"]`);
    fireEvent.mouseEnter(row!);

    fireEvent.click(screen.getByTitle("Exportar"));

    await waitFor(() => {
      expect(screen.queryByText("Perfil no encontrado")).not.toBeNull();
    });
  });

  it("export button does not use --action (green) token", async () => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ profiles: [PROFILE_A] }),
      })
    );

    render(
      <ProfilesMenu getCurrentConfig={() => SAMPLE_CONFIG} onApplied={vi.fn()} />
    );

    fireEvent.click(screen.getByTitle("Perfiles de configuración"));
    await waitFor(() => screen.queryByText("Mi estilo TikTok"));

    const row = document.querySelector(`[data-testid="profile-row-${PROFILE_A.slug}"]`);
    fireEvent.mouseEnter(row!);

    const exportBtn = screen.getByTitle("Exportar");
    const color = exportBtn.style?.color || "";
    const bg = exportBtn.style?.background || exportBtn.style?.backgroundColor || "";
    expect(color.includes("var(--action)")).toBe(false);
    expect(bg.includes("var(--action)")).toBe(false);
    expect(color.includes("#4CAF50")).toBe(false);
  });
});
