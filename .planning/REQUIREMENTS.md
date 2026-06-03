# Requirements: v1.4 — Studio como producto usable

Scoped requirements for milestone v1.4. REQ-IDs continue per-category numbering.
Traceability (phase mapping) is filled by the roadmapper.

> v1.3 (Studio redesign + visual capabilities, Phases 18–22) shipped 2026-06-03 — all its
> requirements (PERSIST, TYPO, OVERLAY, TITLE, STUDIO, D-01..D-11) validated. See PROJECT.md
> and git history for the v1.3 record.

## v1.4 Requirements

### Render Execution & Progress (RENDER)

- [ ] **RENDER-01**: User can start a full video generation from the Studio's "Render Video" button (no curl/manual step).
- [ ] **RENDER-02**: User sees live progress of the running job — current pipeline step and overall percent — until it finishes.
- [ ] **RENDER-03**: User is notified when the render finishes (success) or fails, with the failure reason surfaced.
- [ ] **RENDER-04**: On completion, the user can access the finished video (preview/download) from the Studio.
- [ ] **RENDER-05**: A transient font-load failure during render does not abort the job — font loading is resilient (retry and/or offline-served fonts).

### Named Config Profiles (PROFILE)

- [ ] **PROFILE-01**: User can save the current config as a named profile.
- [ ] **PROFILE-02**: User can load a saved profile, restoring its config into the Studio.
- [ ] **PROFILE-03**: User can list, rename, and delete saved profiles.
- [ ] **PROFILE-04**: Saved profiles persist across Docker rebuilds (same guarantee as the active config).

### AI Social Metadata (META)

- [ ] **META-01**: User can generate social-media metadata (title/description + hashtags) from the video's transcript via Claude API.
- [ ] **META-02**: Generated metadata is shown in the Studio "Metadata de redes" panel (replacing the Phase 22 placeholder).
- [ ] **META-03**: User can edit and copy the generated metadata.
- [ ] **META-04**: User can regenerate the metadata (e.g., adjust tone/platform) without re-running the pipeline.

### UI Convergence (UICONV)

- [ ] **UICONV-01**: The Studio interface converges to the chosen north-star direction (cohesive shell/nav, control density, motion) per the validated sketches.
- [ ] **UICONV-02**: The new surfaces (render progress, metadata panel, profiles) are integrated into the shell to the same visual quality bar (impeccable + frontend-design).

## Future Requirements (deferred)

- Batch/multi-job queue UI in the Studio (api-server already exposes `POST /batch`) — surface later.
- Per-platform export presets (aspect ratios beyond 9:16) — out of current scope.
- Pipeline-step inspection UI (transcript / silence-cut review) — sketched (028/029) but deferred.

## Out of Scope

- Cloud hosting / multi-user accounts — single-user local Studio for now.
- Direct social-network publishing (auto-post to TikTok/IG) — metadata is generated, not posted.
- Real-time collaborative editing.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| _(filled by roadmapper)_ | | |
