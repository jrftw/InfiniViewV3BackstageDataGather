# Project Overview — InfiniView V3 Backstage Gatherer

**Audit date:** 2026-07-11  
**Version:** 1.0.0  
**Commit:** `70496a5`

---

## Purpose

The Backstage Gatherer automates extraction of creator management and performance data from **TikTok LIVE Backstage**, merges it into a unified creator record, enriches it from Google Sheets (CRM, DIP, manual tabs), and publishes to Google Drive, Google Sheets, local files, and MongoDB (`InfiniViewV3`).

InfiniView V3 creator apps and APIs consume the MongoDB output — not the Google Sheet directly.

---

## Business problem

Manual Backstage exports are repetitive, error-prone, and must run on a schedule aligned with US Eastern business hours. The gatherer:

- Runs unattended on a Windows server PC
- Produces consistent combined creator files for ops review
- Dual-writes structured data to MongoDB for the creator app
- Archives daily snapshots to Drive for historical Command Center math

---

## Primary users

| User | Interaction |
|------|-------------|
| **Agency operator (Kevin / staff)** | Dashboard, manual runs, sheet review |
| **InfiniView V3 API** | Reads MongoDB collections populated by gatherer |
| **InfiniView app creators** | Indirect — see stats sourced from gatherer output |
| **Engineers** | Dev PC code changes, server PC deployment |

There are no end-user login flows inside the gatherer itself.

---

## Major workflows

### 1. Scheduled gather (4× daily default)

1. Cron triggers `runGathererJob`
2. Preflight checks (optional)
3. Playwright exports management + performance Excel from Backstage
4. Pipeline merges, filters active creators, enriches, builds outputs
5. Publishes to Drive, Sheets, MongoDB, local cache
6. Optionally chains Profile Acquirer
7. Writes import summary to `data/logs/last-run-summary.json`

### 2. Manual gather

Same pipeline via dashboard, `run-now.bat`, or `npm run gather`.

### 3. Profile Acquirer

Scrapes TikTok public profiles for avatars, bios, recent videos — updates MongoDB and Drive profile images.

### 4. Snapshot history import (nightly)

Imports archived Drive daily spreadsheets into `creator_daily_snapshots` for month-over-month analytics.

### 5. Auto Highlights scan (opt-in)

When enabled, calls InfiniView API `/internal/community/highlights/scan` hourly during 8 AM–8 PM ET.

---

## Platform support

| Platform | Status |
|----------|--------|
| Windows 10/11 server PC | **Primary** — batch files, scheduled tasks, Playwright Chromium |
| macOS / Linux | Not documented — may run Node jobs but Windows scripts assume cmd/PowerShell |
| Cloud/container | Not implemented — designed for on-prem browser session |

---

## Out of scope

- Creator-facing UI
- InfiniCore API or InfiniBoard administration
- Direct EspoCRM writes (CRM sheet is read-only enrichment)
- Real-time streaming metrics
- Multi-agency tenancy

---

## Current status summary

| Capability | Status |
|------------|--------|
| Backstage export automation | Implemented with external configuration required |
| Google publish | Implemented with external configuration required |
| MongoDB dual-write | Implemented with external configuration required |
| Profile Acquirer | Implemented |
| Snapshot history engine | Implemented (enabled by default) |
| Auto Highlights scan | Disabled by default |
| Automated tests in CI | Planned only / gap |
| Dashboard authentication | Not implemented |

---

## Major limitations

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md). Highlights:

- Fragile to Backstage UI changes
- No auth on manual trigger endpoints
- No CI test suite
- Live integrations not verified during documentation audit
