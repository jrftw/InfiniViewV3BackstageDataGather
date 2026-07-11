# InfiniView V3 Backstage Gatherer

Automated TikTok LIVE Backstage export, merge, enrichment, and publish pipeline for InfiniView V3.

**Owner:** Kevin Doyle Jr. / Infinitum Imagery LLC  
**Repository:** [jrftw/InfiniViewV3BackstageDataGather](https://github.com/jrftw/InfiniViewV3BackstageDataGather)  
**Version:** 1.0.0 (`package.json`)  
**Documentation audit:** 2026-07-11  
**Audited commit:** `70496a5` on branch `main`  
**License:** Proprietary — Infinitum Imagery LLC

---

## Status

| Area | Status |
|------|--------|
| TypeScript build (`npm run build`) | Verified — exit 0 on audit machine |
| CI (`.github/workflows/ci.yml`) | Build only — no automated tests |
| Backstage automation | Implemented — requires live Backstage session |
| Google Drive/Sheets publish | Implemented — requires service account + sharing |
| MongoDB dual-write | Implemented — requires `MONGODB_URI` |
| Auto Highlights scan | Disabled by default (`GATHERER_AUTO_HIGHLIGHTS_SCAN_ENABLED=false`) |
| Live end-to-end runs | Unable to verify without production credentials |

This service is designed for a dedicated **Windows server PC** running 24/7. It is not a multi-tenant SaaS.

---

## What it does

```text
TikTok LIVE Backstage (Playwright / Chromium)
        │  management + performance Excel exports
        ▼
Processing (merge, normalize, filter, enrich)
        ├── Local files (data/raw, data/processed)
        ├── Google Drive (archives, profile images)
        ├── Google Sheets (staging / master tab)
        ├── MongoDB InfiniViewV3 (6 collections when configured)
        └── Profile Acquirer (TikTok public profile enrichment)
```

Google Sheets is a **staging and review layer**. InfiniView V3 reads creator performance from **MongoDB** via the InfiniView API, not directly from Sheets.

---

## Technology

| Component | Choice |
|-----------|--------|
| Runtime | Node.js 18+ (CI uses Node 20) |
| Language | TypeScript → CommonJS (`dist/`) |
| Browser automation | Playwright (Chromium) |
| HTTP server | Express on port **3099** (default) |
| Scheduling | node-cron |
| Storage output | Google Drive API, Google Sheets API |
| Database | MongoDB Atlas `InfiniViewV3` when `MONGODB_URI` set |
| Excel parsing | xlsx |
| Logging | pino + pino-pretty |

---

## Two-PC workflow

| PC | Role |
|----|------|
| **Dev PC** | Edit code, push to GitHub |
| **Server PC** | Runs 24/7, auto-pulls updates |

```text
Dev PC  →  git push  →  GitHub  →  auto-update (15 min)  →  Server PC
```

When `start-server.bat` is running, the server pulls, runs `npm ci`, `npm run build`, and restarts after updates. Trigger an immediate check from the dashboard: **Check for Updates**.

---

## Quick start (server PC)

```bat
git clone https://github.com/jrftw/InfiniViewV3BackstageDataGather.git
cd InfiniViewV3BackstageDataGather
install-server.bat
```

1. Edit `.env` (copy from `.env.example`) — Google credentials, optional `MONGODB_URI`
2. `npm run login` — one-time Backstage browser login; session saved to `data/auth/backstage-auth.json`
3. `start-server.bat` — dashboard at http://localhost:3099
4. `setup-server-reliability.bat` — Windows scheduled tasks for boot, watchdog, auto-update

**Detailed run guide:** [Plan/HOW_TO_RUN.md](Plan/HOW_TO_RUN.md) (preserved operational reference)

---

## Manual run options

| Method | Command |
|--------|---------|
| Batch | `run-now.bat` |
| npm | `npm run gather` |
| Dashboard | http://localhost:3099 → Run Backstage Gatherer |
| API | `POST http://localhost:3099/run-now` |
| Full pipeline | `npm run pipeline` (gather + profile acquire) |
| Visible debug | `npm run gather:visible` |

---

## Scheduled runs

Default fixed schedule (America/New_York, configurable via `RUN_SCHEDULE_1`–`RUN_SCHEDULE_4`):

- 8:00 AM, 12:00 PM, 4:00 PM, 8:00 PM

Additional scheduled jobs:

- **Snapshot history import** — nightly at `GATHERER_SNAPSHOT_HISTORY_IMPORT_TIME` (default 00:30 ET)
- **Auto Highlights scan** — hourly 8 AM–8 PM ET when explicitly enabled (disabled by default)

---

## Build and validation

```bat
npm ci
npm run build
```

CI runs the same on `windows-latest` with Node 20 — see [Documentation/BUILD_AND_DEPLOYMENT.md](Documentation/BUILD_AND_DEPLOYMENT.md).

There is **no** `npm test` script and **no** test gate in CI.

---

## Documentation index

### Root

| Document | Purpose |
|----------|---------|
| [CHANGELOG.md](CHANGELOG.md) | Release and unreleased changes |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and PR checklist |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting and secret handling |

### Documentation/

| Document | Purpose |
|----------|---------|
| [PROJECT_OVERVIEW.md](Documentation/PROJECT_OVERVIEW.md) | Purpose, users, workflows |
| [ARCHITECTURE.md](Documentation/ARCHITECTURE.md) | Components and diagrams |
| [FEATURE_INVENTORY.md](Documentation/FEATURE_INVENTORY.md) | Evidence-based feature table |
| [DATA_FLOW_AND_SOURCES.md](Documentation/DATA_FLOW_AND_SOURCES.md) | Source-of-truth matrix |
| [API_REFERENCE.md](Documentation/API_REFERENCE.md) | Express dashboard endpoints |
| [AUTHENTICATION_AND_ROLES.md](Documentation/AUTHENTICATION_AND_ROLES.md) | Backstage session and access model |
| [CONFIGURATION_REFERENCE.md](Documentation/CONFIGURATION_REFERENCE.md) | All environment variables |
| [LOCAL_DEVELOPMENT.md](Documentation/LOCAL_DEVELOPMENT.md) | Dev PC setup |
| [BUILD_AND_DEPLOYMENT.md](Documentation/BUILD_AND_DEPLOYMENT.md) | CI, server deployment, two-PC flow |
| [TESTING_AND_QUALITY.md](Documentation/TESTING_AND_QUALITY.md) | Validation commands and gaps |
| [TROUBLESHOOTING.md](Documentation/TROUBLESHOOTING.md) | Common failures |
| [SECURITY_MODEL.md](Documentation/SECURITY_MODEL.md) | Trust boundaries and gaps |
| [KNOWN_LIMITATIONS.md](Documentation/KNOWN_LIMITATIONS.md) | Confirmed limitations |
| [DEPRECATIONS_AND_LEGACY.md](Documentation/DEPRECATIONS_AND_LEGACY.md) | Legacy paths and disabled features |
| [REPOSITORY_MAP.md](Documentation/REPOSITORY_MAP.md) | Directory guide |
| [EXTERNAL_INTEGRATIONS.md](Documentation/EXTERNAL_INTEGRATIONS.md) | TikTok, Google, MongoDB, InfiniView API |
| [OBSERVABILITY_AND_LOGGING.md](Documentation/OBSERVABILITY_AND_LOGGING.md) | Logging and diagnostics |
| [MAINTENANCE_CHECKLIST.md](Documentation/MAINTENANCE_CHECKLIST.md) | PR, release, and ops checklists |
| [AUDIT_2026-07-11.md](Documentation/AUDIT_2026-07-11.md) | Point-in-time audit snapshot |

### Legacy docs (preserved)

| Path | Notes |
|------|-------|
| [docs/](docs/) | Backstage export steps, field map, Google setup, troubleshooting |
| [Plan/HOW_TO_RUN.md](Plan/HOW_TO_RUN.md) | Step-by-step run guide |

---

## Source-of-truth hierarchy

1. **Executable source code** and active `.env` on the server PC — authoritative for behavior
2. **CHANGELOG.md** — authoritative for released change history
3. **Documentation/AUDIT_2026-07-11.md** — dated snapshot; may drift after code changes
4. **Runtime monitoring** — authoritative for live uptime, quotas, and deployment state

Documentation does not prove that every integration path has been exhaustively tested in production.

---

## Known limitations (summary)

- No authentication on dashboard `/run-now` endpoints (LAN-trusted model)
- No automated test suite in CI
- Backstage UI changes can break Playwright selectors
- `/run-now` and manual triggers block the Express thread until the job completes
- Auto Highlights scan is opt-in and requires `INFINIVIEW_INTERNAL_SERVICE_SECRET`

See [Documentation/KNOWN_LIMITATIONS.md](Documentation/KNOWN_LIMITATIONS.md) for the full list.

---

## Related repositories

| Repo | Role |
|------|------|
| [iViewV3](https://github.com/jrftw/iViewV3) | Creator app; consumes MongoDB via InfiniView API |
| [InfiniCoreAPI](https://github.com/jrftw/InfiniCoreAPI) | Shared creator features |
| [InfinitumServerAgent](https://github.com/jrftw/InfinitumServerAgent) | Optional warehouse handoff |
| [InfiniViewV3-InfiniCoreApi-BSGather](https://github.com/jrftw/InfiniViewV3-InfiniCoreApi-BSGather) | Mass workspace |
