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

    // Assert the new profile appears in the list
    await waitFor(() => {
      expect(screen.queryByText("Nuevo perfil")).not.toBeNull();
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
