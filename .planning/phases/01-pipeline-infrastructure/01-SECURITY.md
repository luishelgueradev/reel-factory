---
phase: 01
slug: pipeline-infrastructure
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-14
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Host ↔ Docker Engine | Docker socket access for container orchestration | Container lifecycle commands |
| Container ↔ Shared Volume | Containers read/write shared volume via bind mount | MP4, JSON, manifest files (internal pipeline data) |
| Environment Variables | .env passes config to containers | Path strings, no secrets |
| External Download → Docker Build | FFmpeg source tarball from ffmpeg.org enters build | Compiled binary in Docker image |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Spoofing | docker-compose.yml | accept | No authentication between containers in v1 — single-host, internal network only | closed |
| T-01-02 | Tampering | Shared volume paths | accept | Containers trust env var paths — single-tenant v1, no multi-user isolation needed | closed |
| T-01-03 | Information Disclosure | Environment variables | mitigate | .env.example committed, .env gitignored; no secrets passed via env vars in v1 | closed |
| T-01-04 | Denial of Service | Shared volume data | accept | No integrity checks on artifacts in v1 — files are internal pipeline data | closed |
| T-01-05 | Tampering | manifest.json | accept | Manifests are internal pipeline metadata — single-tenant, no untrusted readers | closed |
| T-01-06 | Information Disclosure | INPUT_PATH/OUTPUT_PATH | accept | Path traversal not a concern in v1 single-tenant pipeline — containers are trusted | closed |
| T-01-07 | Spoofing | FFmpeg static build download | mitigate | Pinned to specific source tarball (ffmpeg-7.1.1.tar.xz from ffmpeg.org) via HTTPS; Docker layer caching prevents re-downloads | closed |
| T-01-08 | Tampering | Base images | accept | No application code in base images — just runtime + compiled FFmpeg | closed |
| T-01-09 | Denial of Service | Healthcheck paths | accept | Healthcheck checks file existence on shared volume — internal only | closed |
| T-01-10 | Information Disclosure | Docker Compose config | mitigate | docker-compose.yml checked into git — version controlled, reviewable | closed |
| T-01-11 | Elevation of Privilege | FFmpeg in containers | accept | FFmpeg runs in isolated containers with no network access needed | closed |
| T-01-12 | Denial of Service | Smoke test output | accept | Test artifacts in pipeline/ — cleaned up by smoke-test.sh, not persistent | closed |
| T-01-13 | Information Disclosure | manifest.json verification | accept | Verification script trusts manifest data — internal only | closed |
| T-01-06-01 | Tampering | FFmpeg source tarball download | mitigate | HTTPS URL to ffmpeg.org with cryptographic transport; Docker layer caching | closed |
| T-01-06-02 | Tampering | FFmpeg binary integrity in image | accept | Docker image hash provides integrity; no runtime download means no supply-chain drift | closed |
| T-01-06-03 | Spoofing | Build dependency packages (apt) | accept | Debian bookworm-slim packages from official repos — standard risk, no PII | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-01, T-01-05, T-01-06 | Single-tenant v1 pipeline — no auth between containers needed | security-audit | 2026-05-14 |
| AR-02 | T-01-02, T-01-04, T-01-12 | Internal pipeline data, no untrusted readers | security-audit | 2026-05-14 |
| AR-03 | T-01-08, T-01-11 | Base images contain only runtime + FFmpeg, no app code | security-audit | 2026-05-14 |
| AR-04 | T-01-06-02 | Docker image hash provides post-build integrity | security-audit | 2026-05-14 |
| AR-05 | T-01-06-03 | Standard Debian package trust model | security-audit | 2026-05-14 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-14 | 16 | 16 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-14